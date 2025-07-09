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
        nodeData,
        resources: nodeData?.resources,
        resourcesType: typeof nodeData?.resources,
        resourcesIsObject: nodeData?.resources && typeof nodeData.resources === "object",
        selectedResourcesByNode,
        setSelectedResourcesByNode: typeof setSelectedResourcesByNode,
        toggleResource: typeof toggleResource,
        parseProvisionedState: typeof parseProvisionedState,
        individualNodeMenuAnchor,
    });

    // Local state for menus
    const [resourcesActionsAnchor, setResourcesActionsAnchor] = useState(null);
    const [resourceMenuAnchor, setResourceMenuAnchor] = useState(null);
    const [currentResourceId, setCurrentResourceId] = useState(null);

    // Extract node data
    const resources = nodeData?.resources || {};
    const resIds = Object.keys(resources);
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
        setSelectedResourcesByNode((prev) => {
            const newState = {...prev, [node]: checked ? resIds : []};
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
                                (selectedResourcesByNode[node]?.length || 0) === resIds.length &&
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
                                    return (
                                        <Accordion
                                            key={rid}
                                            expanded={expandedResources[`${node}:${rid}`] || false}
                                            onChange={handleAccordionChange(node, rid)}
                                            sx={{
                                                mb: 1,
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
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 2,
                                                    width: "100%",
                                                    p: 1,
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
                                                <Typography variant="body1">{rid}</Typography>
                                                <Box sx={{flexGrow: 1}}/>
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
                                                <IconButton
                                                    onClick={() => handleAccordionChange(node, rid)(null, !expandedResources[`${node}:${rid}`])}
                                                    aria-label={`Expand resource ${rid}`}
                                                >
                                                    <ExpandMoreIcon
                                                        sx={{
                                                            transform: expandedResources[`${node}:${rid}`] ? "rotate(180deg)" : "rotate(0deg)",
                                                            transition: "transform 0.2s",
                                                        }}
                                                    />
                                                </IconButton>
                                            </Box>
                                            <AccordionDetails>
                                                <Box sx={{display: "flex", flexDirection: "column", gap: 1}}>
                                                    <Typography variant="body2">
                                                        <strong>Label:</strong> {res.label || "N/A"}
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        <strong>Type:</strong> {res.type || "N/A"}
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        <strong>Provisioned:</strong>
                                                        <Tooltip
                                                            title={parseProvisionedState(res.provisioned?.state) ? "true" : "false"}
                                                        >
                                                            <FiberManualRecordIcon
                                                                sx={{
                                                                    color: parseProvisionedState(res.provisioned?.state) ? green[500] : red[500],
                                                                    fontSize: "1rem",
                                                                    ml: 1,
                                                                    verticalAlign: "middle",
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        <strong>Last Updated:</strong> {res.provisioned?.mtime || "N/A"}
                                                    </Typography>
                                                </Box>
                                            </AccordionDetails>
                                        </Accordion>
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
