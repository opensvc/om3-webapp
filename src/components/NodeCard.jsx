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
import {green, red, orange, grey, blue} from "@mui/material/colors";
import {INSTANCE_ACTIONS, RESOURCE_ACTIONS} from "../constants/actions";

const NodeCard = ({
                      node,
                      nodeData,
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
                      expandedResources = {},
                      handleAccordionChange = () => console.warn("handleAccordionChange not provided"),
                      getColor = () => grey[500],
                      getNodeState = () => ({avail: "unknown", frozen: "unfrozen", state: null}),
                      setPendingAction = () => console.warn("setPendingAction not provided"),
                      setConfirmDialogOpen = () => console.warn("setConfirmDialogOpen not provided"),
                      setStopDialogOpen = () => console.warn("setStopDialogOpen not provided"),
                      setUnprovisionDialogOpen = () => console.warn("setUnprovisionDialogOpen not provided"),
                      setPurgeDialogOpen = () => console.warn("setPurgeDialogOpen not provided"),
                      setSimpleDialogOpen = () => console.warn("setSimpleDialogOpen not provided"),
                      setCheckboxes = () => console.warn("setCheckboxes not provided"),
                      setStopCheckbox = () => console.warn("setStopCheckbox not provided"),
                      setUnprovisionCheckboxes = () => console.warn("setUnprovisionCheckboxes not provided"),
                      setPurgeCheckboxes = () => console.warn("setPurgeCheckboxes not provided"),
                      setSelectedResourcesByNode = () => console.warn("setSelectedResourcesByNode not provided"),
                      parseProvisionedState = (state) => !!state,
                  }) => {
    // Log received props for debugging
    console.log("NodeCard render:", {
        node,
        resources: nodeData?.resources,
        encap: nodeData?.instance_status?.encap,
        instanceConfig: nodeData?.instanceConfig,
        instanceMonitor: nodeData?.instanceMonitor,
    });

    // Local state for menus
    const [resourcesActionsAnchor, setResourcesActionsAnchor] = useState(null);
    const [resourceMenuAnchor, setResourceMenuAnchor] = useState(null);
    const [currentResourceId, setCurrentResourceId] = useState(null);

    // Extract node data
    const resources = nodeData?.resources || {};
    const resIds = Object.keys(resources);
    const encapData = nodeData?.instance_status?.encap || {};
    const {avail, frozen, state} = getNodeState(node);

    // Mock encap resources if not present in event data
    const defaultEncapResources = {
        'fs#1': {status: 'up', label: 'flag /dev/shm/opensvc/svc/encap/fs#1.flag', type: 'fs'},
        'fs#2': {status: 'up', label: 'flag /dev/shm/opensvc/svc/encap/fs#2.flag', type: 'fs'},
    };
    const mockEncapData = {
        'container#1': {resources: defaultEncapResources},
        'container#2': {resources: defaultEncapResources},
    };
    const effectiveEncapData = {...mockEncapData, ...encapData};

    // Mock instanceMonitor for restart count
    const defaultInstanceMonitor = {
        resources: {
            'fs#1': {restart: {remaining: 1}},
            'fs#2': {restart: {remaining: 1}},
        },
    };
    const effectiveInstanceMonitor = {
        resources: {
            ...defaultInstanceMonitor.resources,
            ...(nodeData?.instanceMonitor?.resources || {}),
        },
    };

    // Mock instanceConfig for is_monitored
    const defaultInstanceConfig = {
        resources: {
            'fs#1': {is_monitored: true, is_disabled: false, is_standby: false, restart: 0},
            'fs#2': {is_monitored: true, is_disabled: false, is_standby: false, restart: 0},
        },
    };
    const effectiveInstanceConfig = {
        resources: {
            ...defaultInstanceConfig.resources,
            ...(nodeData?.instanceConfig?.resources || {}),
        },
    };

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
            ...resIds.flatMap(rid =>
                resources[rid]?.type === 'container.docker' && effectiveEncapData[rid]?.resources
                    ? Object.keys(effectiveEncapData[rid].resources)
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
        } else if (action === "purge") {
            setPurgeCheckboxes({
                dataLoss: false,
                configLoss: false,
                serviceInterruption: false,
            });
            setPurgeDialogOpen(true);
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
    };

    // Helper function to determine resource status letters and tooltip
    const getResourceStatusLetters = (rid, resourceData, instanceConfig, instanceMonitor, isEncap = false) => {
        const letters = ['.', '.', '.', '.', '.', '.', '.', '.'];
        const tooltipDescriptions = [
            'Not Running',
            'Not Monitored',
            'Enabled',
            'Not Optional',
            isEncap ? 'Encap' : 'Not Encap',
            'Provisioned',
            'Not Standby',
            'No Restart',
        ];

        // (1) R: Running (check if 'running' exists in InstanceStatusUpdated)
        if (resourceData?.running !== undefined) {
            letters[0] = 'R';
            tooltipDescriptions[0] = 'Running';
        }

        // (2) M: Monitored (check is_monitored in instanceConfig)
        if (instanceConfig?.resources?.[rid]?.is_monitored === true) {
            letters[1] = 'M';
            tooltipDescriptions[1] = 'Monitored';
        }

        // (3) D: Disabled (check is_disabled in instanceConfig)
        if (instanceConfig?.resources?.[rid]?.is_disabled === true) {
            letters[2] = 'D';
            tooltipDescriptions[2] = 'Disabled';
        }

        // (4) O: Optional (check optional in InstanceStatusUpdated)
        if (resourceData?.optional === true) {
            letters[3] = 'O';
            tooltipDescriptions[3] = 'Optional';
        }

        // (5) E: Encap (set to 'E' for encap resources, '.' otherwise)
        if (isEncap) {
            letters[4] = 'E';
            tooltipDescriptions[4] = 'Encap';
        }

        // (6) P: Not Provisioned (check provisioned.state in InstanceStatusUpdated)
        if (resourceData?.provisioned?.state === 'false' || resourceData?.provisioned?.state === false || resourceData?.provisioned?.state === 'n/a') {
            letters[5] = 'P';
            tooltipDescriptions[5] = 'Not Provisioned';
        }

        // (7) S: Standby (check is_standby in instanceConfig)
        if (instanceConfig?.resources?.[rid]?.is_standby === true) {
            letters[6] = 'S';
            tooltipDescriptions[6] = 'Standby';
        }

        // (8) Remaining Restart (check restart in instanceConfig first, then instanceMonitor)
        const configRestarts = instanceConfig?.resources?.[rid]?.restart;
        const monitorRestarts = instanceMonitor?.resources?.[rid]?.restart?.remaining;
        const remainingRestarts = typeof configRestarts === 'number' && configRestarts > 0
            ? configRestarts
            : typeof monitorRestarts === 'number'
                ? monitorRestarts
                : undefined;
        if (typeof remainingRestarts === 'number') {
            letters[7] = remainingRestarts > 10 ? '+' : remainingRestarts.toString();
            tooltipDescriptions[7] = remainingRestarts > 10 ? 'More than 10 Restarts' : `${remainingRestarts} Restart${remainingRestarts === 1 ? '' : 's'} Remaining`;
        }

        const statusString = letters.join('');
        const tooltipText = tooltipDescriptions.join(', ');
        console.log("Status letters for", rid, ":", {
            statusString,
            tooltipText,
            is_monitored: instanceConfig?.resources?.[rid]?.is_monitored,
            restart: remainingRestarts
        });
        return {statusString, tooltipText};
    };

    // Helper function to render a resource row
    const renderResourceRow = (rid, res, instanceConfig, instanceMonitor, isEncap = false) => {
        const {
            statusString,
            tooltipText
        } = getResourceStatusLetters(rid, res, instanceConfig, instanceMonitor, isEncap);
        const labelText = res.label || "N/A";
        const infoText = res.info?.actions === "disabled" ? "info: actions disabled" : "";

        console.log("Rendering resource row:", {
            rid,
            statusString,
            status: res.status,
            label: labelText,
            isEncap,
            tooltipText,
        });

        return (
            <Box
                key={rid}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    fontFamily: "'Roboto Mono', monospace",
                    fontSize: "0.9rem",
                }}
            >
                {/* Indented content for checkbox, rid, status letters, and label */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        flexGrow: 1,
                        pl: isEncap ? 4 : 0, // Indent only the content
                    }}
                >
                    <Box onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                            checked={(selectedResourcesByNode[node] || []).includes(rid)}
                            onChange={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                toggleResource(node, rid);
                                console.log("Individual resource checkbox clicked:", {
                                    node,
                                    rid,
                                    selectedResourcesByNode,
                                });
                            }}
                            aria-label={`Select resource ${rid}`}
                        />
                    </Box>
                    <Typography sx={{minWidth: "80px", fontFamily: "'Roboto Mono', monospace"}}>{rid}</Typography>
                    <Tooltip title={tooltipText}>
                        <Typography
                            sx={{minWidth: "80px", fontFamily: "'Roboto Mono', monospace"}}>{statusString}</Typography>
                    </Tooltip>
                    <Typography sx={{flexGrow: 1, fontFamily: "'Roboto Mono', monospace"}}>
                        {labelText}
                        {infoText && (
                            <Typography component="span"
                                        sx={{ml: 1, color: "textSecondary", fontFamily: "'Roboto Mono', monospace"}}>
                                {infoText}
                            </Typography>
                        )}
                    </Typography>
                </Box>
                {/* Status icon and action button */}
                <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
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
                                    e.stopPropagation();
                                    e.preventDefault();
                                    toggleNode(node);
                                    console.log("toggleNode called:", {node, selectedNodes});
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
                                (resIds.length + resIds.reduce((acc, rid) =>
                                    resources[rid]?.type === 'container.docker' && effectiveEncapData[rid]?.resources
                                        ? acc + Object.keys(effectiveEncapData[rid].resources).length
                                        : acc, 0)) &&
                                resIds.length > 0
                            }
                            onChange={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
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
                                    const isContainer = res.type === 'container.docker';
                                    const encapRes = isContainer && effectiveEncapData[rid]?.resources
                                        ? effectiveEncapData[rid].resources
                                        : {};
                                    const encapResIds = Object.keys(encapRes);

                                    console.log("Rendering resource:", {
                                        rid,
                                        isContainer,
                                        encapRes,
                                        encapResIds,
                                        resourceData: res,
                                    });

                                    return (
                                        <Box key={rid}>
                                            {/* Render top-level resource */}
                                            {renderResourceRow(rid, res, effectiveInstanceConfig, effectiveInstanceMonitor, false)}
                                            {/* Render encap resources if container and encap resources exist */}
                                            {isContainer && encapResIds.length > 0 && (
                                                <Box sx={{ml: 4}}>
                                                    {encapResIds.map((encapRid) => (
                                                        renderResourceRow(
                                                            encapRid,
                                                            encapRes[encapRid] || {},
                                                            effectiveInstanceConfig,
                                                            effectiveInstanceMonitor,
                                                            true // isEncap
                                                        )
                                                    ))}
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
                    >
                        <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                        <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                    </MenuItem>
                ))}
            </Menu>

            {/* Menu for individual resource actions */}
            <Menu
                anchorEl={resourceMenuAnchor}
                open={Boolean(resourceMenuAnchor)}
                onClose={() => setResourceMenuAnchor(null)}
                onClick={(e) => e.stopPropagation()}
            >
                {RESOURCE_ACTIONS.map(({name, icon}) => (
                    <MenuItem
                        key={name}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleResourceActionClick(name);
                        }}
                    >
                        <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                        <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    );
};

export default NodeCard;
