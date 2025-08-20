import React, {useEffect, useState} from "react";
import {
    Box,
    Typography,
    Tooltip,
    Checkbox,
    IconButton,
    Accordion,
    AccordionDetails,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Button,
} from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {grey, blue, orange} from "@mui/material/colors";
import {INSTANCE_ACTIONS, RESOURCE_ACTIONS} from "../constants/actions";

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
                      individualNodeMenuAnchor = null,
                      expandedNodeResources = {},
                      handleNodeResourcesAccordionChange = () => console.warn("handleNodeResourcesAccordionChange not provided"),
                      getColor = () => grey[500],
                      getNodeState = () => ({avail: "unknown", frozen: "unfrozen", state: null}),
                      setPendingAction = () => console.warn("setPendingAction not provided"),
                      setConfirmDialogOpen = () => console.warn("setConfirmDialogOpen not provided"),
                      setStopDialogOpen = () => console.warn("setStopDialogOpen not provided"),
                      setUnprovisionDialogOpen = () => console.warn("setUnprovisionDialogOpen not provided"),
                      setSimpleDialogOpen = () => console.warn("setSimpleDialogOpen not provided"),
                      setCheckboxes = () => console.warn("setCheckboxes not provided"),
                      setStopCheckbox = () => console.warn("setStopCheckbox not provided"),
                      setUnprovisionCheckboxes = () => console.warn("setUnprovisionCheckboxes not provided"),
                      setSelectedResourcesByNode = () => console.warn("setSelectedResourcesByNode not provided"),
                      parseProvisionedState = (state) => !!state,
                  }) => {
    if (!node) {
        console.error("Node name is required");
        return null;
    }

    // Log received props for debugging
    console.log("NodeCard render:", {
        node,
        resources: nodeData?.resources,
        encap: nodeData?.encap,
        instanceConfig: nodeData?.instanceConfig,
        instanceMonitor: nodeData?.instanceMonitor,
    });

    // Local state for menus
    const [resourcesActionsAnchor, setResourcesActionsAnchor] = useState(null);
    const [resourceMenuAnchor, setResourceMenuAnchor] = useState(null);
    const [currentResourceId, setCurrentResourceId] = useState(null);

    // Extract node data with defaults
    const resources = nodeData?.resources || {};
    const resIds = Object.keys(resources);
    const encapData = nodeData?.encap || {};
    const effectiveInstanceConfig = nodeData?.instanceConfig || {resources: {}};
    const effectiveInstanceMonitor = nodeData?.instanceMonitor || {resources: {}};
    const {avail, frozen, state} = getNodeState(node);

    // Log changes to selectedResourcesByNode
    useEffect(() => {
        console.log("selectedResourcesByNode changed:", selectedResourcesByNode);
    }, [selectedResourcesByNode]);

    // Handler for selecting all resources
    const handleSelectAllResources = (checked) => {
        console.log("handleSelectAllResources:", {node, checked, resIds});
        if (typeof setSelectedResourcesByNode !== "function") {
            console.error("setSelectedResourcesByNode is not a function:", setSelectedResourcesByNode);
            return;
        }
        const allResourceIds = [
            ...resIds,
            ...resIds.flatMap((rid) =>
                resources[rid]?.type?.toLowerCase().includes("container") && encapData[rid]?.resources
                    ? Object.keys(encapData[rid].resources)
                    : []
            ),
        ];
        setSelectedResourcesByNode((prev) => {
            const newState = {...prev, [node]: checked ? allResourceIds : []};
            console.log("After handleSelectAllResources, new selectedResourcesByNode:", newState);
            return newState;
        });
    };

    // Handler for individual node actions
    const handleIndividualNodeActionClick = (action) => {
        console.log("handleIndividualNodeActionClick:", {action, node, frozen});
        setCurrentNode(node);
        setPendingAction({action, node});
        if (action === "freeze") {
            setCheckboxes({failover: false});
            setConfirmDialogOpen(true);
        } else if (action === "stop") {
            setStopCheckbox(false);
            setStopDialogOpen(true);
        } else if (action === "unprovision") {
            setUnprovisionCheckboxes({
                dataLoss: false,
                serviceInterruption: false,
            });
            setUnprovisionDialogOpen(true);
        } else {
            setSimpleDialogOpen(true);
        }
        setIndividualNodeMenuAnchor(null);
    };

    // Handler for batch resource actions
    const handleBatchResourceActionClick = (action) => {
        console.log("handleBatchResourceActionClick:", {
            action,
            node,
            selectedResources: selectedResourcesByNode[node],
        });
        setPendingAction({action, batch: "resources", node});
        setSimpleDialogOpen(true);
        setResourcesActionsAnchor(null);
    };

    // Handler for individual resource actions
    const handleResourceActionClick = (action) => {
        console.log("handleResourceActionClick:", {action, node, rid: currentResourceId});
        setPendingAction({action, node, rid: currentResourceId});
        setSimpleDialogOpen(true);
        setResourceMenuAnchor(null);
        setCurrentResourceId(null);
    };

    // Helper function to filter resource actions based on type
    const getFilteredResourceActions = (resourceType) => {
        console.log("getFilteredResourceActions called with resourceType:", resourceType);
        if (!resourceType) {
            console.log("No resource type provided, returning all actions");
            return RESOURCE_ACTIONS;
        }
        const typePrefix = resourceType.split('.')[0].toLowerCase();
        console.log("Resource type prefix:", typePrefix);
        if (typePrefix === 'task') {
            console.log("Type is task, returning only 'run' action");
            return RESOURCE_ACTIONS.filter(action => action.name === 'run');
        }
        if (['fs', 'disk', 'app', 'container'].includes(typePrefix)) {
            console.log(`Type prefix is ${typePrefix}, excluding 'run' action`);
            return RESOURCE_ACTIONS.filter(action => action.name !== 'run');
        }
        console.log("No special filtering, returning all actions");
        return RESOURCE_ACTIONS;
    };

    // Helper function to get resource type for a given resource ID
    const getResourceType = (rid) => {
        if (!rid) {
            console.warn("getResourceType called with undefined or null rid");
            return '';
        }
        console.log(`getResourceType called for rid: ${rid}`);
        // Check top-level resources
        const topLevelType = resources[rid]?.type;
        if (topLevelType) {
            console.log(`Found resource type in resources[${rid}]: ${topLevelType}`);
            return topLevelType;
        }
        // Check encapsulated resources
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

    // Helper function to determine resource status letters and tooltip
    const getResourceStatusLetters = (rid, resourceData, instanceConfig, instanceMonitor, isEncap = false) => {
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

        // Handle running state
        if (resourceData?.running !== undefined) {
            letters[0] = resourceData.running ? "R" : ".";
            tooltipDescriptions[0] = resourceData.running ? "Running" : "Not Running";
        }

        // Handle monitored state
        const isMonitored = instanceConfig?.resources?.[rid]?.is_monitored;
        if (isMonitored === true || isMonitored === "true") {
            letters[1] = "M";
            tooltipDescriptions[1] = "Monitored";
        }

        // Handle disabled state
        const isDisabled = instanceConfig?.resources?.[rid]?.is_disabled;
        if (isDisabled === true || isDisabled === "true") {
            letters[2] = "D";
            tooltipDescriptions[2] = "Disabled";
        }

        // Handle optional state
        if (resourceData?.optional === true || resourceData?.optional === "true") {
            letters[3] = "O";
            tooltipDescriptions[3] = "Optional";
        }

        // Handle encap state
        if (isEncap) {
            letters[4] = "E";
            tooltipDescriptions[4] = "Encap";
        }

        // Handle provisioned state
        const provisionedState = resourceData?.provisioned?.state;
        if (provisionedState === "false" || provisionedState === false || provisionedState === "n/a") {
            letters[5] = "P";
            tooltipDescriptions[5] = "Not Provisioned";
        }

        // Handle standby state
        const isStandby = instanceConfig?.resources?.[rid]?.is_standby;
        if (isStandby === true || isStandby === "true") {
            letters[6] = "S";
            tooltipDescriptions[6] = "Standby";
        }

        // Handle restart count
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
        console.log("Status letters for", rid, ":", {
            statusString,
            tooltipText,
            is_monitored: isMonitored,
            restart: remainingRestarts,
        });
        return {statusString, tooltipText};
    };

    // Helper function to render a resource row
    const renderResourceRow = (rid, res, instanceConfig, instanceMonitor, isEncap = false) => {
        if (!res) {
            console.error(`Resource data is null or undefined for ${rid}`);
            return null;
        }

        const {
            statusString,
            tooltipText
        } = getResourceStatusLetters(rid, res, instanceConfig, instanceMonitor, isEncap);
        const labelText = res.label || "N/A";
        const infoText = res.info?.actions === "disabled" ? "info: actions disabled" : "";
        const resourceType = res.type || "N/A";

        console.log("Rendering resource row:", {
            rid,
            statusString,
            status: res.status,
            label: labelText,
            type: resourceType,
            isEncap,
            tooltipText,
        });

        return (
            <Box
                key={rid}
                sx={{
                    display: "flex",
                    flexDirection: {xs: "column", sm: "row"},
                    alignItems: {xs: "flex-start", sm: "center"},
                    width: "100%",
                    fontFamily: "'Roboto Mono', monospace",
                    fontSize: "0.9rem",
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
                            onChange={(e) => {
                                toggleResource(node, rid);
                                console.log("Individual resource checkbox clicked:", {
                                    node,
                                    rid,
                                    checked: e.target.checked,
                                    selectedResourcesByNode,
                                });
                            }}
                            aria-label={`Select resource ${rid}`}
                        />
                    </Box>
                    <Typography
                        sx={{
                            minWidth: {xs: "60px", sm: "80px"},
                            fontFamily: "'Roboto Mono', monospace",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
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
                            }}
                        >
                            {resourceType}
                        </Typography>
                        <Typography
                            sx={{
                                fontFamily: "'Roboto Mono', monospace",
                                whiteSpace: "normal",
                                wordBreak: "break-word",
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
                            <FiberManualRecordIcon
                                sx={{
                                    color: typeof getColor === "function" ? getColor(res.status) : grey[500],
                                    fontSize: "1rem",
                                }}
                            />
                        </Tooltip>
                        <Box onClick={(e) => e.stopPropagation()}>
                            <IconButton
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentResourceId(rid);
                                    handleResourceMenuOpen(node, rid, e);
                                }}
                                disabled={actionInProgress}
                                aria-label={`Resource ${rid} actions`}
                            >
                                <Tooltip title="Actions">
                                    <MoreVertIcon/>
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
                        <FiberManualRecordIcon
                            sx={{
                                color: typeof getColor === "function" ? getColor(res.status) : grey[500],
                                fontSize: "1rem",
                            }}
                        />
                    </Tooltip>
                    <Box onClick={(e) => e.stopPropagation()}>
                        <IconButton
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentResourceId(rid);
                                handleResourceMenuOpen(node, rid, e);
                            }}
                            disabled={actionInProgress}
                            aria-label={`Resource ${rid} actions`}
                            sx={{p: 0.5}}
                        >
                            <Tooltip title="Actions">
                                <MoreVertIcon/>
                            </Tooltip>
                        </IconButton>
                    </Box>
                </Box>
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
            {/* Node header */}
            <Box sx={{p: 1}}>
                <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                    <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                        <Box onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                                checked={selectedNodes.includes(node)}
                                onChange={(e) => {
                                    toggleNode(node);
                                    console.log("Node checkbox clicked:", {
                                        node,
                                        checked: e.target.checked,
                                        selectedNodes,
                                    });
                                }}
                                aria-label={`Select node ${node}`}
                            />
                        </Box>
                        <Typography variant="h6">{node}</Typography>
                    </Box>
                    <Box sx={{display: "flex", alignItems: "center", gap: 2}}>
                        <Tooltip title={avail || "unknown"}>
                            <FiberManualRecordIcon
                                sx={{
                                    color: typeof getColor === "function" ? getColor(avail) : grey[500],
                                    fontSize: "1.2rem",
                                }}
                            />
                        </Tooltip>
                        {avail === "warn" && (
                            <Tooltip title="warn">
                                <WarningAmberIcon sx={{color: orange[500], fontSize: "1.2rem"}}/>
                            </Tooltip>
                        )}
                        {frozen === "frozen" && (
                            <Tooltip title="frozen">
                                <AcUnitIcon sx={{fontSize: "medium", color: blue[300]}}/>
                            </Tooltip>
                        )}
                        {state && <Typography variant="caption">{state}</Typography>}
                        <IconButton
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentNode(node);
                                setIndividualNodeMenuAnchor(e.currentTarget);
                            }}
                            disabled={actionInProgress}
                            aria-label={`Node ${node} actions`}
                        >
                            <Tooltip title="Actions">
                                <MoreVertIcon/>
                            </Tooltip>
                        </IconButton>
                    </Box>
                </Box>
            </Box>

            {/* Resources accordion */}
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
                                            encapData[rid]?.resources
                                                ? acc + Object.keys(encapData[rid].resources).length
                                                : acc,
                                        0
                                    )) &&
                                resIds.length > 0
                            }
                            onChange={(e) => {
                                console.log("Select all checkbox clicked:", {node, checked: e.target.checked});
                                handleSelectAllResources(e.target.checked);
                            }}
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
                                    e.stopPropagation();
                                    handleResourcesActionsOpen(node, e);
                                }}
                                disabled={!(selectedResourcesByNode[node] || []).length}
                                aria-label={`Resource actions for node ${node}`}
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

                                    console.log("Rendering resource:", {
                                        rid,
                                        isContainer,
                                        encapRes,
                                        encapResIds,
                                        resourceData: res,
                                        resourceType: res.type,
                                        encapDataForRid: encapData[rid],
                                    });

                                    return (
                                        <Box key={rid}>
                                            {/* Render top-level resource */}
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
                                            {isContainer && encapResIds.length > 0 && (
                                                <Box sx={{ml: 4}}>
                                                    {encapResIds.map((encapRid) => {
                                                        console.log("Rendering encap resource:", {
                                                            encapRid,
                                                            data: encapRes[encapRid],
                                                        });
                                                        return renderResourceRow(
                                                            encapRid,
                                                            encapRes[encapRid] || {},
                                                            effectiveInstanceConfig,
                                                            effectiveInstanceMonitor,
                                                            true
                                                        );
                                                    })}
                                                </Box>
                                            )}
                                            {isContainer && encapResIds.length === 0 && encapData[rid]?.resources !== undefined && (
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

            {/* Menu for node actions */}
            <Menu
                anchorEl={individualNodeMenuAnchor}
                open={Boolean(individualNodeMenuAnchor)}
                onClose={() => setIndividualNodeMenuAnchor(null)}
                onClick={(e) => e.stopPropagation()}
            >
                {INSTANCE_ACTIONS.map(({name, icon}) => (
                    <MenuItem
                        key={name}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleIndividualNodeActionClick(name);
                        }}
                        aria-label={`Node ${node} ${name} action`}
                    >
                        <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                        <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                    </MenuItem>
                ))}
            </Menu>

            {/* Menu for batch resource actions */}
            <Menu
                anchorEl={resourcesActionsAnchor}
                open={Boolean(resourcesActionsAnchor)}
                onClose={() => setResourcesActionsAnchor(null)}
                onClick={(e) => e.stopPropagation()}
            >
                {RESOURCE_ACTIONS.map(({name, icon}) => (
                    <MenuItem
                        key={name}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleBatchResourceActionClick(name);
                        }}
                        aria-label={`Batch resource ${name} action for node ${node}`}
                    >
                        <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                        <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                    </MenuItem>
                ))}
            </Menu>

            {/* Menu for individual resource actions */}
            <Menu
                anchorEl={resourceMenuAnchor}
                open={Boolean(resourceMenuAnchor) && Boolean(currentResourceId)}
                onClose={() => {
                    setResourceMenuAnchor(null);
                    setCurrentResourceId(null);
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {(() => {
                    if (!currentResourceId) {
                        console.error("No currentResourceId set, cannot render resource actions menu");
                        return [];
                    }
                    const resourceType = getResourceType(currentResourceId);
                    const filteredActions = getFilteredResourceActions(resourceType);
                    console.log("Rendering resource actions menu:", {
                        currentResourceId,
                        resourceType,
                        filteredActions: filteredActions.map(action => action.name),
                    });
                    return filteredActions.map(({name, icon}) => {
                        console.log(`Rendering MenuItem for action: ${name}`);
                        return (
                            <MenuItem
                                key={name}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleResourceActionClick(name);
                                }}
                                aria-label={`Resource ${currentResourceId} ${name} action`}
                            >
                                <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                                <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                            </MenuItem>
                        );
                    });
                })()}
            </Menu>
        </Box>
    );
};

export default NodeCard;
