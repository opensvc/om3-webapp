import React, {useEffect, useState} from "react";
import {
    Box,
    Typography,
    Tooltip,
    Checkbox,
    IconButton,
    Accordion,
    AccordionDetails,
    ClickAwayListener,
    Popper,
    Paper,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Button,
} from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArticleIcon from "@mui/icons-material/Article";
import {grey, blue, orange, red} from "@mui/material/colors";
import {RESOURCE_ACTIONS} from "../constants/actions";

const NodeCard = ({
                      node,
                      nodeData = {},
                      selectedNodes = [],
                      toggleNode = () => console.warn("toggleNode not provided"),
                      selectedResourcesByNode = {},
                      toggleResource = () => console.warn("toggleResource not provided"),
                      actionInProgress = false,
                      setIndividualNodeMenuAnchor = () => console.warn("setIndividualNodeMenuAnchor not provided"),
                      setCurrentNode = () => console.warn("setCurrentNode not provided"),
                      handleResourcesActionsOpen = () => console.warn("handleResourcesActionsOpen not provided"),
                      handleResourceMenuOpen = () => console.warn("handleResourceMenuOpen not provided"),
                      individualNodeMenuAnchorRef = null,
                      resourcesActionsAnchorRef = null,
                      resourceMenuAnchorRef = null,
                      expandedNodeResources = {},
                      handleNodeResourcesAccordionChange = () => console.warn("handleNodeResourcesAccordionChange not provided"),
                      getColor = () => grey[500],
                      getNodeState = () => ({avail: "unknown", frozen: "unfrozen", state: null}),
                      setPendingAction = () => console.warn("setPendingAction not provided"),
                      setSimpleDialogOpen = () => console.warn("setSimpleDialogOpen not provided"),
                      setSelectedResourcesByNode = () => console.warn("setSelectedResourcesByNode not provided"),
                      parseProvisionedState = (state) => !!state,
                      instanceName,
                      onOpenLogs = () => console.warn("onOpenLogs not provided"),
                  }) => {
    // Local state for menus
    const [resourcesActionsAnchor, setResourcesActionsAnchor] = useState(null);
    const [resourceMenuAnchor, setResourceMenuAnchor] = useState(null);
    const [currentResourceId, setCurrentResourceId] = useState(null);
    const resolvedInstanceName = instanceName || nodeData?.instanceName || nodeData?.name;

    useEffect(() => {
        console.log("selectedResourcesByNode changed:", selectedResourcesByNode);
    }, [selectedResourcesByNode]);

    if (!node) {
        console.error("Node name is required");
        return null;
    }

    const getZoomLevel = () => {
        return window.devicePixelRatio || 1;
    };

    // Configuration of Popper props
    const popperProps = () => ({
        placement: "bottom-end",
        disablePortal: true,
        modifiers: [
            {
                name: "offset",
                options: {
                    offset: () => {
                        const zoomLevel = getZoomLevel();
                        return [0, 8 / zoomLevel];
                    },
                },
            },
            {
                name: "preventOverflow",
                options: {
                    boundariesElement: "viewport",
                },
            },
            {
                name: "flip",
                options: {
                    enabled: true,
                },
            },
        ],
        sx: {
            zIndex: 1300,
            "& .MuiPaper-root": {
                minWidth: 200,
                boxShadow: "0px 5px15px rgba(0,0,0,0.2)",
            },
        },
    });

    // Extract node data with defaults
    const resources = nodeData?.resources || {};
    const resIds = Object.keys(resources);
    const encapData = nodeData?.encap || {};
    const effectiveInstanceConfig = nodeData?.instanceConfig || {resources: {}};
    const effectiveInstanceMonitor = nodeData?.instanceMonitor || {resources: {}};
    const {avail, frozen, state} = getNodeState(node);
    const isInstanceNotProvisioned = nodeData?.provisioned !== undefined ? !parseProvisionedState(nodeData.provisioned) : false;

    // Handler for selecting all resources
    const handleSelectAllResources = (checked) => {
        if (typeof setSelectedResourcesByNode !== "function") {
            console.error("setSelectedResourcesByNode is not a function:", setSelectedResourcesByNode);
            return;
        }
        const allResourceIds = [
            ...resIds,
            ...resIds.flatMap((rid) =>
                resources[rid]?.type?.toLowerCase().includes("container") && encapData[rid]?.resources && resources[rid]?.status !== "down"
                    ? Object.keys(encapData[rid].resources)
                    : []
            ),
        ];
        setSelectedResourcesByNode((prev) => ({
            ...prev,
            [node]: checked ? allResourceIds : [],
        }));
    };

    const handleBatchResourceActionClick = (action) => {
        setPendingAction({action, batch: "resources", node});
        setSimpleDialogOpen(true);
        setResourcesActionsAnchor(null);
    };

    const handleResourceActionClick = (action) => {
        setPendingAction({action, node, rid: currentResourceId});
        setSimpleDialogOpen(true);
        setResourceMenuAnchor(null);
        setCurrentResourceId(null);
    };

    const getFilteredResourceActions = (resourceType) => {
        if (!resourceType) {
            return RESOURCE_ACTIONS;
        }
        const typePrefix = resourceType.split('.')[0].toLowerCase();
        if (typePrefix === 'task') {
            return RESOURCE_ACTIONS.filter((action) => action.name === 'run');
        }
        if (['fs', 'disk', 'app'].includes(typePrefix)) {
            return RESOURCE_ACTIONS.filter((action) => action.name !== 'run' && action.name !== 'console');
        }
        if (typePrefix === 'container') {
            return RESOURCE_ACTIONS.filter((action) => action.name !== 'run');
        }
        return RESOURCE_ACTIONS;
    };

    const getResourceType = (rid) => {
        if (!rid) {
            console.warn("getResourceType called with undefined or null rid");
            return '';
        }
        console.log(`getResourceType called for rid: ${rid}`);
        const topLevelType = resources[rid]?.type;
        if (topLevelType) {
            console.log(`Found resource type in resources[${rid}]: ${topLevelType}`);
            return topLevelType;
        }
        for (const containerId of Object.keys(encapData)) {
            const encapType = encapData[containerId]?.resources?.[rid]?.type;
            if (encapType) {
                console.log(`Found resource type in encapData[${containerId}].resources[${rid}]: ${encapType}`);
                return encapType;
            }
        }
        console.warn(`Resource type not found for rid: ${rid}, returning empty string`);
        return '';
    };

    const getResourceStatusLetters = (rid, resourceData, instanceConfig, instanceMonitor, isEncap = false, encapData = {}) => {
        const letters = [".", ".", ".", ".", ".", ".", ".", "."];
        const tooltipDescriptions = [
            "Not Running",
            "Not Monitored",
            "Enabled",
            "Not Optional",
            isEncap ? "Encap" : "Not Encap",
            "Provisioned",
            "Not Standby",
            "No Restart",
        ];
        if (resourceData?.running !== undefined) {
            letters[0] = resourceData.running ? "R" : ".";
            tooltipDescriptions[0] = resourceData.running ? "Running" : "Not Running";
        }
        const isMonitored = instanceConfig?.resources?.[rid]?.is_monitored;
        if (isMonitored === true || isMonitored === "true") {
            letters[1] = "M";
            tooltipDescriptions[1] = "Monitored";
        }
        const isDisabled = instanceConfig?.resources?.[rid]?.is_disabled;
        if (isDisabled === true || isDisabled === "true") {
            letters[2] = "D";
            tooltipDescriptions[2] = "Disabled";
        }
        if (resourceData?.optional === true || resourceData?.optional === "true") {
            letters[3] = "O";
            tooltipDescriptions[3] = "Optional";
        }
        if (isEncap) {
            letters[4] = "E";
            tooltipDescriptions[4] = "Encap";
        }
        let provisionedState = resourceData?.provisioned?.state;
        const isContainer = resourceData?.type?.toLowerCase().includes("container");
        if (isContainer && encapData[rid]?.provisioned !== undefined) {
            provisionedState = encapData[rid].provisioned;
        }
        if (provisionedState === "false" || provisionedState === false || provisionedState === "n/a") {
            letters[5] = "P";
            tooltipDescriptions[5] = "Not Provisioned";
        } else if (provisionedState === "true" || provisionedState === true) {
            tooltipDescriptions[5] = "Provisioned";
        } else {
            tooltipDescriptions[5] = "Provisioned";
        }
        const isStandby = instanceConfig?.resources?.[rid]?.is_standby;
        if (isStandby === true || isStandby === "true") {
            letters[6] = "S";
            tooltipDescriptions[6] = "Standby";
        }
        const configRestarts = instanceConfig?.resources?.[rid]?.restart;
        const monitorRestarts = instanceMonitor?.resources?.[rid]?.restart?.remaining;
        let remainingRestarts;
        if (typeof configRestarts === "number" && configRestarts > 0) {
            remainingRestarts = configRestarts;
        } else if (typeof monitorRestarts === "number") {
            remainingRestarts = monitorRestarts;
        }
        if (typeof remainingRestarts === "number") {
            letters[7] = remainingRestarts === 0 ? "." : remainingRestarts > 10 ? "+" : remainingRestarts.toString();
            tooltipDescriptions[7] =
                remainingRestarts === 0
                    ? "No Restart"
                    : remainingRestarts > 10
                        ? "More than 10 Restarts"
                        : `${remainingRestarts} Restart${remainingRestarts === 1 ? "" : "s"} Remaining`;
        }
        const statusString = letters.join("");
        const tooltipText = tooltipDescriptions.join(", ");
        return {statusString, tooltipText};
    };

    const renderResourceRow = (rid, res, instanceConfig, instanceMonitor, isEncap = false) => {
        if (!res) {
            return null;
        }
        const {statusString, tooltipText} = getResourceStatusLetters(
            rid,
            res,
            instanceConfig,
            instanceMonitor,
            isEncap,
            encapData
        );
        const labelText = res.label || "N/A";
        const infoText = res.info?.actions === "disabled" ? "info: actions disabled" : "";
        const resourceType = res.type || "N/A";
        const isContainer = resourceType.toLowerCase().includes("container");
        const provisionedState = isContainer && encapData[rid]?.provisioned !== undefined
            ? encapData[rid].provisioned
            : res?.provisioned?.state;
        const isResourceNotProvisioned = provisionedState === "false" || provisionedState === false || provisionedState === "n/a";
        const logs = res.log || [];
        const getLogPaddingLeft = () => {
            if (isEncap) {
                return {xs: "72px", sm: "72px"};
            } else {
                return {xs: "56px", sm: "56px"};
            }
        };

        return (
            <Box
                key={rid}
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    fontFamily: "'Roboto Mono', monospace",
                    fontSize: "0.9rem",
                    gap: 1,
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: {xs: "column", sm: "row"},
                        alignItems: {xs: "flex-start", sm: "center"},
                        width: "100%",
                        gap: {xs: 1, sm: 2},
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: {xs: 1, sm: 2},
                            width: "100%",
                            pl: isEncap ? {xs: 4, sm: 4} : {xs: 2, sm: 0},
                        }}
                    >
                        <Box onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                                checked={(selectedResourcesByNode[node] || []).includes(rid)}
                                onChange={() => toggleResource(node, rid)}
                                aria-label={`Select resource ${rid}`}
                                sx={{
                                    padding: {xs: '4px', sm: '8px'},
                                    '& .MuiSvgIcon-root': {fontSize: {xs: '1rem', sm: '1.25rem'}}
                                }}
                            />
                        </Box>
                        <Typography
                            sx={{
                                minWidth: {xs: "60px", sm: "80px"},
                                fontFamily: "'Roboto Mono', monospace",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontSize: {xs: '0.8rem', sm: '0.9rem'}
                            }}
                        >
                            {rid}
                        </Typography>
                        <Box
                            sx={{
                                display: {xs: "none", sm: "flex"},
                                alignItems: "center",
                                gap: 2,
                                flexGrow: 0,
                            }}
                        >
                            <Tooltip title={tooltipText}>
                                <Typography
                                    role="status"
                                    sx={{
                                        minWidth: {sm: "80px"},
                                        fontFamily: "'Roboto Mono', monospace",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        fontSize: '0.9rem'
                                    }}
                                    aria-label={`Resource ${rid} status: ${statusString}`}
                                >
                                    {statusString}
                                </Typography>
                            </Tooltip>
                            <Typography
                                sx={{
                                    minWidth: {sm: "80px"},
                                    fontFamily: "'Roboto Mono', monospace",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    fontSize: '0.9rem'
                                }}
                            >
                                {resourceType}
                            </Typography>
                            <Typography
                                sx={{
                                    fontFamily: "'Roboto Mono', monospace",
                                    whiteSpace: "normal",
                                    wordBreak: "break-word",
                                    fontSize: '0.9rem'
                                }}
                            >
                                {labelText}
                                {infoText && (
                                    <Typography
                                        component="span"
                                        sx={{
                                            ml: 1,
                                            color: "textSecondary",
                                            fontFamily: "'Roboto Mono', monospace",
                                            whiteSpace: "normal",
                                            wordBreak: "break-word",
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        {infoText}
                                    </Typography>
                                )}
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                display: {xs: "flex", sm: "none"},
                                alignItems: "center",
                                gap: 1,
                                flexShrink: 0,
                                marginLeft: "auto",
                            }}
                        >
                            <Tooltip title={res.status || "unknown"}>
                                {res.status === "warn" ? (
                                    <PriorityHighIcon
                                        sx={{
                                            fontSize: "1rem",
                                            color: typeof getColor === "function" ? getColor(res.status) : grey[500]
                                        }}
                                    />
                                ) : (
                                    <FiberManualRecordIcon
                                        sx={{
                                            fontSize: "1rem",
                                            color: typeof getColor === "function" ? getColor(res.status) : grey[500]
                                        }}
                                    />
                                )}
                            </Tooltip>
                            {isResourceNotProvisioned && (
                                <Tooltip title="Not Provisioned">
                                    <PriorityHighIcon
                                        sx={{color: red[500], fontSize: "1rem"}}
                                        aria-label={`Resource ${rid} is not provisioned`}
                                    />
                                </Tooltip>
                            )}
                            <Box onClick={(e) => e.stopPropagation()}>
                                <IconButton
                                    onClick={(e) => {
                                        e.persist();
                                        e.stopPropagation();
                                        setCurrentResourceId(rid);
                                        handleResourceMenuOpen(node, rid, e);
                                    }}
                                    disabled={actionInProgress}
                                    aria-label={`Resource ${rid} actions`}
                                    sx={{padding: '4px'}}
                                    ref={resourceMenuAnchorRef}
                                >
                                    <Tooltip title="Actions">
                                        <MoreVertIcon sx={{fontSize: '1rem'}}/>
                                    </Tooltip>
                                </IconButton>
                            </Box>
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            pl: isEncap ? 4 : 2,
                            display: {xs: "block", sm: "none"},
                            width: "100%",
                        }}
                    >
                        <Tooltip title={tooltipText}>
                            <Typography
                                role="status"
                                sx={{
                                    fontFamily: "'Roboto Mono', monospace",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    fontSize: '0.8rem'
                                }}
                                aria-label={`Resource ${rid} status: ${statusString}`}
                            >
                                {statusString}
                            </Typography>
                        </Tooltip>
                    </Box>
                    <Box
                        sx={{
                            pl: isEncap ? 4 : 2,
                            display: {xs: "block", sm: "none"},
                            width: "100%",
                        }}
                    >
                        <Typography
                            sx={{
                                fontFamily: "'Roboto Mono', monospace",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontSize: '0.8rem'
                            }}
                        >
                            {resourceType}
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            pl: isEncap ? 4 : 2,
                            display: {xs: "block", sm: "none"},
                            width: "100%",
                        }}
                    >
                        <Typography
                            sx={{
                                fontFamily: "'Roboto Mono', monospace",
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                                fontSize: '0.8rem'
                            }}
                        >
                            {labelText}
                            {infoText && (
                                <Typography
                                    component="span"
                                    sx={{
                                        ml: 1,
                                        color: "textSecondary",
                                        fontFamily: "'Roboto Mono', monospace",
                                        whiteSpace: "normal",
                                        wordBreak: "break-word",
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    {infoText}
                                </Typography>
                            )}
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            display: {xs: "none", sm: "flex"},
                            alignItems: "center",
                            gap: 1,
                            flexShrink: 0,
                            flexGrow: 1,
                            justifyContent: "flex-end",
                        }}
                    >
                        <Tooltip title={res.status || "unknown"}>
                            {res.status === "warn" ? (
                                <PriorityHighIcon
                                    sx={{
                                        fontSize: "1rem",
                                        color: typeof getColor === "function" ? getColor(res.status) : grey[500]
                                    }}
                                />
                            ) : (
                                <FiberManualRecordIcon
                                    sx={{
                                        fontSize: "1rem",
                                        color: typeof getColor === "function" ? getColor(res.status) : grey[500]
                                    }}
                                />
                            )}
                        </Tooltip>
                        {isResourceNotProvisioned && (
                            <Tooltip title="Not Provisioned">
                                <PriorityHighIcon
                                    sx={{color: red[500], fontSize: "1rem"}}
                                    aria-label={`Resource ${rid} is not provisioned`}
                                />
                            </Tooltip>
                        )}
                        <Box onClick={(e) => e.stopPropagation()}>
                            <IconButton
                                onClick={(e) => {
                                    e.persist();
                                    e.stopPropagation();
                                    setCurrentResourceId(rid);
                                    handleResourceMenuOpen(node, rid, e);
                                }}
                                disabled={actionInProgress}
                                aria-label={`Resource ${rid} actions`}
                                sx={{p: 0.5}}
                                ref={resourceMenuAnchorRef}
                            >
                                <Tooltip title="Actions">
                                    <MoreVertIcon sx={{fontSize: '1rem'}}/>
                                </Tooltip>
                            </IconButton>
                        </Box>
                    </Box>
                </Box>
                {logs.length > 0 && (
                    <Box
                        sx={{
                            pl: getLogPaddingLeft(),
                            width: "100%",
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.5,
                            mt: 0.5,
                        }}
                    >
                        {logs.map((log, index) => (
                            <Typography
                                key={index}
                                sx={{
                                    fontFamily: "'Roboto Mono', monospace",
                                    fontSize: "0.8rem",
                                    color: log.level === "warn" ? orange[500] : log.level === "error" ? red[500] : "textSecondary",
                                    whiteSpace: "normal",
                                    wordBreak: "break-word",
                                    lineHeight: 1.3,
                                }}
                                aria-label={`Log for resource ${rid}: ${log.level} - ${log.message}`}
                            >
                                {log.level}: {log.message}
                            </Typography>
                        ))}
                    </Box>
                )}
            </Box>
        );
    };

    return (
        <Box
            sx={{
                mb: 5,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                p: 2,
                width: "100%",
                maxWidth: "1400px",
                overflowX: "auto",
            }}
        >
            <Box sx={{p: 1}}>
                <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                    <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                        <Box onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                                checked={selectedNodes.includes(node)}
                                onChange={() => toggleNode(node)}
                                aria-label={`Select node ${node}`}
                            />
                        </Box>
                        <Typography variant="h6">{node}</Typography>
                    </Box>
                    <Box sx={{display: "flex", alignItems: "center", gap: 2}}>
                        <Tooltip title="View logs">
                            <IconButton
                                onClick={() => onOpenLogs(node, resolvedInstanceName)}
                                color="primary"
                                aria-label={`View logs for instance ${resolvedInstanceName || node}`}
                            >
                                <ArticleIcon/>
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={avail || "unknown"}>
                            {avail === "warn" ? (
                                <PriorityHighIcon
                                    sx={{
                                        fontSize: "1.2rem",
                                        color: typeof getColor === "function" ? getColor(avail) : grey[500]
                                    }}
                                />
                            ) : (
                                <FiberManualRecordIcon
                                    sx={{
                                        fontSize: "1.2rem",
                                        color: typeof getColor === "function" ? getColor(avail) : grey[500]
                                    }}
                                />
                            )}
                        </Tooltip>
                        {frozen === "frozen" && (
                            <Tooltip title="frozen">
                                <AcUnitIcon sx={{fontSize: "medium", color: blue[300]}}/>
                            </Tooltip>
                        )}
                        {isInstanceNotProvisioned && (
                            <Tooltip title="Not Provisioned">
                                <PriorityHighIcon
                                    sx={{color: red[500], fontSize: "1.2rem"}}
                                    aria-label={`Instance on node ${node} is not provisioned`}
                                />
                            </Tooltip>
                        )}
                        {state && <Typography variant="caption">{state}</Typography>}
                        <IconButton
                            onClick={(e) => {
                                e.persist();
                                e.stopPropagation();
                                setCurrentNode(node);
                                setIndividualNodeMenuAnchor(e.currentTarget);
                            }}
                            disabled={actionInProgress}
                            aria-label={`Node ${node} actions`}
                            ref={individualNodeMenuAnchorRef}
                        >
                            <Tooltip title="Actions">
                                <MoreVertIcon/>
                            </Tooltip>
                        </IconButton>
                    </Box>
                </Box>
            </Box>
            <Accordion
                expanded={expandedNodeResources[node] || false}
                onChange={handleNodeResourcesAccordionChange(node)}
                sx={{
                    border: "none",
                    boxShadow: "none",
                    backgroundColor: "transparent",
                    "&:before": {display: "none"},
                    "& .MuiAccordionDetails-root": {
                        border: "none",
                        backgroundColor: "transparent",
                        padding: 0,
                    },
                }}
            >
                <Box sx={{display: "flex", alignItems: "center", gap: 2, width: "100%", p: 1}}>
                    <Typography variant="subtitle1" fontWeight="medium">
                        Resources ({resIds.length})
                    </Typography>
                    <Box onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                            checked={
                                (selectedResourcesByNode[node]?.length || 0) ===
                                (resIds.length +
                                    resIds.reduce(
                                        (acc, rid) =>
                                            resources[rid]?.type?.toLowerCase().includes("container") &&
                                            encapData[rid]?.resources && resources[rid]?.status !== "down"
                                                ? acc + Object.keys(encapData[rid].resources).length
                                                : acc,
                                        0
                                    )) &&
                                resIds.length > 0
                            }
                            onChange={(e) => handleSelectAllResources(e.target.checked)}
                            disabled={resIds.length === 0}
                            aria-label={`Select all resources for node ${node}`}
                        />
                    </Box>
                    <Box sx={{flexGrow: 1}}/>
                    <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                        <Box onClick={(e) => e.stopPropagation()}>
                            <Button
                                variant="outlined"
                                onClick={(e) => {
                                    e.persist();
                                    e.stopPropagation();
                                    handleResourcesActionsOpen(node, e);
                                    setResourcesActionsAnchor(e.currentTarget);
                                }}
                                disabled={!(selectedResourcesByNode[node] || []).length}
                                aria-label={`Resource actions for node ${node}`}
                                ref={resourcesActionsAnchorRef}
                            >
                                Actions on Selected Resources
                            </Button>
                        </Box>
                        <IconButton
                            onClick={() => handleNodeResourcesAccordionChange(node)(null, !expandedNodeResources[node])}
                            aria-label={`Expand resources for node ${node}`}
                        >
                            <ExpandMoreIcon
                                sx={{
                                    transform: expandedNodeResources[node] ? "rotate(180deg)" : "rotate(0deg)",
                                    transition: "transform 0.2s",
                                }}
                            />
                        </IconButton>
                    </Box>
                </Box>
                <AccordionDetails>
                    <Box>
                        {resIds.length === 0 ? (
                            <Typography color="textSecondary">No resources available.</Typography>
                        ) : (
                            <Box sx={{display: "flex", flexDirection: "column", gap: 1}}>
                                {resIds.map((rid) => {
                                    const res = resources[rid] || {};
                                    const isContainer = res.type?.toLowerCase().includes("container") || false;
                                    const encapRes = isContainer && encapData[rid]?.resources ? encapData[rid].resources : {};
                                    const encapResIds = Object.keys(encapRes);
                                    return (
                                        <Box key={rid}>
                                            {renderResourceRow(rid, res, effectiveInstanceConfig, effectiveInstanceMonitor, false)}
                                            {isContainer && !encapData[rid] && (
                                                <Box sx={{ml: 4}}>
                                                    <Typography color="textSecondary">
                                                        No encapsulated data available for {rid}.
                                                    </Typography>
                                                </Box>
                                            )}
                                            {isContainer && encapData[rid] && !encapData[rid].resources && (
                                                <Box sx={{ml: 4}}>
                                                    <Typography color="textSecondary">
                                                        Encapsulated data found for {rid}, but no resources defined.
                                                    </Typography>
                                                </Box>
                                            )}
                                            {isContainer && encapResIds.length > 0 && res.status !== "down" && (
                                                <Box sx={{ml: 4}}>
                                                    {encapResIds.map((encapRid) => (
                                                        renderResourceRow(
                                                            encapRid,
                                                            encapRes[encapRid] || {},
                                                            effectiveInstanceConfig,
                                                            effectiveInstanceMonitor,
                                                            true
                                                        )
                                                    ))}
                                                </Box>
                                            )}
                                            {isContainer && encapResIds.length === 0 && encapData[rid]?.resources !== undefined && !isInstanceNotProvisioned && (
                                                <Box sx={{ml: 4}}>
                                                    <Typography color="textSecondary">
                                                        No encapsulated resources available for {rid}.
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Box>
                                    );
                                })}
                            </Box>
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>

            {/* Resource batch actions menu */}
            <Popper
                open={Boolean(resourcesActionsAnchor)}
                anchorEl={resourcesActionsAnchor}
                {...popperProps()}
            >
                <ClickAwayListener onClickAway={() => setResourcesActionsAnchor(null)}>
                    <Paper elevation={3} role="menu" aria-label={`Batch resource actions for node ${node}`}>
                        {RESOURCE_ACTIONS.map(({name, icon}) => (
                            <MenuItem
                                key={name}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleBatchResourceActionClick(name);
                                }}
                                role="menuitem"
                                aria-label={name.charAt(0).toUpperCase() + name.slice(1)}
                            >
                                <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                                <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                            </MenuItem>
                        ))}
                    </Paper>
                </ClickAwayListener>
            </Popper>

            {/* Individual resource actions menu */}
            <Popper
                open={Boolean(resourceMenuAnchor) && Boolean(currentResourceId)}
                anchorEl={resourceMenuAnchor}
                {...popperProps()}
            >
                <ClickAwayListener
                    onClickAway={() => {
                        setResourceMenuAnchor(null);
                        setCurrentResourceId(null);
                    }}
                >
                    <Paper elevation={3} role="menu" aria-label={`Resource ${currentResourceId} actions menu`}>
                        {(() => {
                            if (!currentResourceId) {
                                return [];
                            }
                            const resourceType = getResourceType(currentResourceId);
                            const filteredActions = getFilteredResourceActions(resourceType);
                            return filteredActions.map(({name, icon}) => (
                                <MenuItem
                                    key={name}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleResourceActionClick(name);
                                    }}
                                    role="menuitem"
                                    aria-label={name.charAt(0).toUpperCase() + name.slice(1)}
                                >
                                    <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                                    <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                                </MenuItem>
                            ));
                        })()}
                    </Paper>
                </ClickAwayListener>
            </Popper>
        </Box>
    );
};

export default NodeCard;
