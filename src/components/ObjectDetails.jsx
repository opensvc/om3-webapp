import React, {useState, useMemo, useEffect} from "react";
import {useParams} from "react-router-dom";
import {
    Box, Paper, Typography, Tooltip, Divider, Snackbar, Alert,
    Menu, MenuItem, IconButton, Dialog, DialogTitle,
    DialogContent, DialogActions, FormControlLabel, Checkbox,
    Button, Accordion, AccordionSummary, AccordionDetails
} from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {green, red, grey, blue, orange} from "@mui/material/colors";
import useEventStore from "../hooks/useEventStore.js";
import {closeEventSource} from "../eventSourceManager.jsx";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus.jsx";

const NODE_ACTIONS = ["start", "stop", "restart", "freeze", "unfreeze", "provision", "unprovision"];
const OBJECT_ACTIONS = ["start", "restart", "freeze", "unfreeze", "stop", "provision", "unprovision", "purge"];
const RESOURCE_ACTIONS = ["start", "stop", "restart"];

const ObjectDetail = () => {
    const {objectName} = useParams();
    const decodedObjectName = decodeURIComponent(objectName);
    const {fetchNodes, startEventReception} = useFetchDaemonStatus();

    const objectStatus = useEventStore((s) => s.objectStatus);
    const objectInstanceStatus = useEventStore((s) => s.objectInstanceStatus);
    const objectData = objectInstanceStatus?.[decodedObjectName];
    const globalStatus = objectStatus?.[decodedObjectName];

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            fetchNodes(token);
            startEventReception(token);
        }
        return () => {
            closeEventSource();
        };
    }, [fetchNodes, startEventReception]);

    // State for batch selection & actions
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [nodesActionsAnchor, setNodesActionsAnchor] = useState(null);
    const [individualNodeMenuAnchor, setIndividualNodeMenuAnchor] = useState(null);
    const [currentNode, setCurrentNode] = useState(null);

    const [selectedResourcesByNode, setSelectedResourcesByNode] = useState({});
    const [resGroupNode, setResGroupNode] = useState(null);
    const [resourcesActionsAnchor, setResourcesActionsAnchor] = useState(null);
    const [resourceMenuAnchor, setResourceMenuAnchor] = useState(null);
    const [currentResourceId, setCurrentResourceId] = useState(null);

    // State for dialogs & snackbar
    const [objectMenuAnchor, setObjectMenuAnchor] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);
    const [actionInProgress, setActionInProgress] = useState(false);

    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [stopDialogOpen, setStopDialogOpen] = useState(false);
    const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
    const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);

    const [checkboxes, setCheckboxes] = useState({failover: false});
    const [stopCheckbox, setStopCheckbox] = useState(false);
    const [resourceConfirmChecked, setResourceConfirmChecked] = useState(false);

    const [snackbar, setSnackbar] = useState({open: false, message: "", severity: "success"});

    // State for accordion expansion
    const [expandedAccordions, setExpandedAccordions] = useState({});

    const openSnackbar = (msg, sev = "success") => setSnackbar({open: true, message: msg, severity: sev});
    const closeSnackbar = () => setSnackbar((s) => ({...s, open: false}));

    // Helper functions
    const parseObjectPath = (objName) => {
        const parts = objName.split("/");
        if (parts.length === 3) {
            return {namespace: parts[0], kind: parts[1], name: parts[2]};
        }
        return {namespace: "root", kind: "svc", name: objName};
    };

    const postObjectAction = async ({action}) => {
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) return openSnackbar("Auth token not found.", "error");

        setActionInProgress(true);
        openSnackbar(`Executing ${action} on object…`, "info");
        const url = `/object/path/${namespace}/${kind}/${name}/action/${action}`;
        try {
            const res = await fetch(url, {method: "POST", headers: {Authorization: `Bearer ${token}`}});
            if (!res.ok) throw new Error();
            openSnackbar(`'${action}' succeeded on object`);
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    };

    const postNodeAction = async ({node, action}) => {
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) return openSnackbar("Auth token not found.", "error");

        setActionInProgress(true);
        openSnackbar(`Executing ${action} on node ${node}…`, "info");
        const url = `/node/name/${node}/instance/path/${namespace}/${kind}/${name}/action/${action}`;
        try {
            const res = await fetch(url, {method: "POST", headers: {Authorization: `Bearer ${token}`}});
            if (!res.ok) throw new Error();
            openSnackbar(`'${action}' succeeded on node '${node}'`);
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    };

    const postResourceAction = async ({node, action, rid}) => {
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) return openSnackbar("Auth token not found.", "error");

        setActionInProgress(true);
        openSnackbar(`Executing ${action} on resource ${rid}…`, "info");
        const url = `/node/name/${node}/instance/path/${namespace}/${kind}/${name}/action/${action}?rid=${encodeURIComponent(rid)}`;
        try {
            const res = await fetch(url, {method: "POST", headers: {Authorization: `Bearer ${token}`}});
            if (!res.ok) throw new Error();
            openSnackbar(`'${action}' succeeded on resource '${rid}'`);
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    };

    // Color helper
    const getColor = (status) => {
        if (status === "up" || status === true) return green[500];
        if (status === "down" || status === false) return red[500];
        if (status === "warn") return orange[500];
        return grey[500];
    };

    // Batch node actions handlers
    const handleNodesActionsOpen = (e) => setNodesActionsAnchor(e.currentTarget);
    const handleNodesActionsClose = () => setNodesActionsAnchor(null);
    const handleBatchNodeActionClick = (action) => {
        setPendingAction({action, batch: "nodes"});
        if (action === "freeze") setConfirmDialogOpen(true);
        else if (action === "stop") setStopDialogOpen(true);
        else setSimpleDialogOpen(true);
        handleNodesActionsClose();
    };

    // Individual node actions handlers
    const handleIndividualNodeActionClick = (action) => {
        setPendingAction({action, node: currentNode});
        if (action === "freeze") setConfirmDialogOpen(true);
        else if (action === "stop") setStopDialogOpen(true);
        else setSimpleDialogOpen(true);
        setIndividualNodeMenuAnchor(null);
    };

    // Batch resource actions handlers
    const handleResourcesActionsOpen = (node, e) => {
        setResGroupNode(node);
        setResourcesActionsAnchor(e.currentTarget);
    };
    const handleResourcesActionsClose = () => setResourcesActionsAnchor(null);
    const handleBatchResourceActionClick = (action) => {
        setPendingAction({action, batch: "resources", node: resGroupNode});
        setSimpleDialogOpen(true);
        handleResourcesActionsClose();
    };

    // Accordion expansion handler
    const handleAccordionChange = (panel) => (event, isExpanded) => {
        setExpandedAccordions((prev) => ({
            ...prev,
            [panel]: isExpanded,
        }));
    };

    // Dialog confirm handler
    const handleDialogConfirm = () => {
        if (!pendingAction) return;
        if (pendingAction.batch === "nodes") {
            selectedNodes.forEach((node) => postNodeAction({node, action: pendingAction.action}));
            setSelectedNodes([]);
        } else if (pendingAction.node && !pendingAction.rid) {
            postNodeAction({node: pendingAction.node, action: pendingAction.action});
        } else if (pendingAction.batch === "resources") {
            const rids = selectedResourcesByNode[pendingAction.node] || [];
            rids.forEach((rid) => postResourceAction({node: pendingAction.node, action: pendingAction.action, rid}));
            setSelectedResourcesByNode((prev) => ({...prev, [pendingAction.node]: []}));
        } else if (pendingAction.rid) {
            postResourceAction({node: pendingAction.node, action: pendingAction.action, rid: pendingAction.rid});
        } else {
            postObjectAction(pendingAction);
        }
        setPendingAction(null);
        setCheckboxes({failover: false});
        setStopCheckbox(false);
        setResourceConfirmChecked(false);
        setConfirmDialogOpen(false);
        setStopDialogOpen(false);
        setResourceDialogOpen(false);
        setSimpleDialogOpen(false);
    };

    // Selection helpers
    const toggleNode = (node) =>
        setSelectedNodes((prev) =>
            prev.includes(node) ? prev.filter((n) => n !== node) : [...prev, node]
        );

    const toggleResource = (node, rid) => {
        setSelectedResourcesByNode((prev) => {
            const current = prev[node] || [];
            const next = current.includes(rid)
                ? current.filter((r) => r !== rid)
                : [...current, rid];
            return {...prev, [node]: next};
        });
    };

    // Memoize data to prevent unnecessary re-renders
    const memoizedObjectData = useMemo(() => objectData, [objectData]);
    const memoizedNodes = useMemo(() => Object.keys(memoizedObjectData || {}), [memoizedObjectData]);

    if (!memoizedObjectData) {
        return (
            <Box p={4}>
                <Typography align="center" color="textSecondary" fontSize="1.2rem">
                    No information available for object <code>{decodedObjectName}</code>.
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{display: "flex", justifyContent: "center", px: 2, py: 4}}>
            <Box sx={{width: "100%", maxWidth: "1400px"}}>
                {/* HEADER */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h4" fontWeight="bold">
                        {decodedObjectName}
                    </Typography>
                    <Box>
                        <IconButton onClick={(e) => setObjectMenuAnchor(e.currentTarget)} disabled={actionInProgress}>
                            <MoreVertIcon/>
                        </IconButton>
                        <Menu
                            anchorEl={objectMenuAnchor}
                            open={Boolean(objectMenuAnchor)}
                            onClose={() => setObjectMenuAnchor(null)}
                        >
                            {OBJECT_ACTIONS.map((action) => (
                                <MenuItem
                                    key={action}
                                    onClick={() => {
                                        setPendingAction({action});
                                        if (action === "freeze") setConfirmDialogOpen(true);
                                        else setSimpleDialogOpen(true);
                                        setObjectMenuAnchor(null);
                                    }}
                                >
                                    {action}
                                </MenuItem>
                            ))}
                        </Menu>
                    </Box>
                </Box>

                {/* GLOBAL STATUS */}
                {globalStatus && (
                    <Paper elevation={2} sx={{p: 3, borderRadius: 3, mb: 4, backgroundColor: "#f9fafb"}}>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Typography variant="h6" fontWeight="medium" fontSize="1.3rem">
                                Global Status
                            </Typography>
                            <Box display="flex" alignItems="center" gap={2}>
                                <FiberManualRecordIcon sx={{color: getColor(globalStatus.avail), fontSize: "1.3rem"}}/>
                                {globalStatus.avail === "warn" && (
                                    <Tooltip title="Warning">
                                        <WarningAmberIcon sx={{color: orange[500]}}/>
                                    </Tooltip>
                                )}
                                {globalStatus.frozen === "frozen" && (
                                    <Tooltip title="Frozen">
                                        <AcUnitIcon fontSize="medium" sx={{color: blue[300]}}/>
                                    </Tooltip>
                                )}
                            </Box>
                        </Box>
                    </Paper>
                )}

                {/* BATCH NODE ACTIONS */}
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <Button
                        variant="outlined"
                        onClick={handleNodesActionsOpen}
                        disabled={selectedNodes.length === 0}
                    >
                        Actions on selected nodes
                    </Button>
                </Box>

                {/* LIST OF NODES */}
                {memoizedNodes.map((node) => {
                    const {avail, frozen_at, resources = {}} = memoizedObjectData[node] || {};
                    const isFrozen = frozen_at && frozen_at !== "0001-01-01T00:00:00Z";
                    const resIds = Object.keys(resources);
                    const panelId = `resources-${node}`;

                    return (
                        <Paper key={node} elevation={3} sx={{p: 3, mb: 5, borderRadius: 3}}>
                            {/* NODE HEADER WITH SELECT */}
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <Checkbox
                                        checked={selectedNodes.includes(node)}
                                        onChange={() => toggleNode(node)}
                                    />
                                    <Typography variant="h6">Node: {node}</Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={2}>
                                    <FiberManualRecordIcon sx={{color: getColor(avail), fontSize: "1.2rem"}}/>
                                    {isFrozen && (
                                        <Tooltip title="Frozen">
                                            <AcUnitIcon fontSize="medium" sx={{color: blue[300]}}/>
                                        </Tooltip>
                                    )}
                                    <IconButton
                                        onClick={(e) => {
                                            setCurrentNode(node);
                                            setIndividualNodeMenuAnchor(e.currentTarget);
                                        }}
                                        disabled={actionInProgress}
                                    >
                                        <MoreVertIcon/>
                                    </IconButton>
                                </Box>
                            </Box>

                            <Divider sx={{mb: 2}}/>

                            {/* RESOURCES SECTION */}
                            <Box mb={2}>
                                <Box display="flex" alignItems="center" gap={2} mb={1}>
                                    <Typography variant="subtitle1" fontWeight="medium">
                                        Resources ({resIds.length})
                                    </Typography>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Checkbox
                                            checked={(selectedResourcesByNode[node] || []).length === resIds.length && resIds.length > 0}
                                            onChange={(e) => {
                                                const next = e.target.checked ? resIds : [];
                                                setSelectedResourcesByNode((prev) => ({...prev, [node]: next}));
                                            }}
                                            disabled={resIds.length === 0}
                                        />
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={(e) => handleResourcesActionsOpen(node, e)}
                                            disabled={!(selectedResourcesByNode[node] || []).length}
                                        >
                                            Actions on selected
                                        </Button>
                                    </Box>
                                </Box>

                                {resIds.length === 0 ? (
                                    <Typography color="textSecondary">No resources available.</Typography>
                                ) : (
                                    <Accordion
                                        expanded={expandedAccordions[panelId] || false}
                                        onChange={handleAccordionChange(panelId)}
                                        sx={{mb: 1}}
                                    >
                                        <AccordionSummary
                                            expandIcon={<ExpandMoreIcon/>}
                                            aria-controls={`panel-${panelId}-content`}
                                            id={`panel-${panelId}-header`}
                                        >
                                            <Typography>All Resources</Typography>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <Box sx={{display: "flex", flexDirection: "column", gap: 1}}>
                                                {resIds.map((rid) => {
                                                    const res = resources[rid] || {};
                                                    const resourcePanelId = `resource-${node}-${rid}`;
                                                    return (
                                                        <Accordion
                                                            key={rid}
                                                            expanded={expandedAccordions[resourcePanelId] || false}
                                                            onChange={handleAccordionChange(resourcePanelId)}
                                                            sx={{mb: 1}}
                                                        >
                                                            <AccordionSummary
                                                                expandIcon={<ExpandMoreIcon/>}
                                                                aria-controls={`panel-${resourcePanelId}-content`}
                                                                id={`panel-${resourcePanelId}-header`}
                                                            >
                                                                <Box display="flex" alignItems="center" gap={2}
                                                                     width="100%">
                                                                    <Checkbox
                                                                        checked={(selectedResourcesByNode[node] || []).includes(rid)}
                                                                        onChange={() => toggleResource(node, rid)}
                                                                    />
                                                                    <Typography variant="body1">{rid}</Typography>
                                                                    <Box flexGrow={1}/>
                                                                    <FiberManualRecordIcon
                                                                        sx={{
                                                                            color: getColor(res.status),
                                                                            fontSize: "1rem"
                                                                        }}
                                                                    />
                                                                    <Button
                                                                        variant="outlined"
                                                                        size="small"
                                                                        onClick={(e) => {
                                                                            setResGroupNode(node);
                                                                            setCurrentResourceId(rid);
                                                                            setResourceMenuAnchor(e.currentTarget);
                                                                            e.stopPropagation(); // Prevent accordion toggle on button click
                                                                        }}
                                                                        disabled={actionInProgress}
                                                                    >
                                                                        Actions
                                                                    </Button>
                                                                </Box>
                                                            </AccordionSummary>
                                                            <AccordionDetails>
                                                                <Box sx={{
                                                                    display: "flex",
                                                                    flexDirection: "column",
                                                                    gap: 1
                                                                }}>
                                                                    <Typography variant="body2">
                                                                        <strong>Label:</strong> {res.label || "N/A"}
                                                                    </Typography>
                                                                    <Typography variant="body2">
                                                                        <strong>Type:</strong> {res.type || "N/A"}
                                                                    </Typography>
                                                                    <Typography variant="body2">
                                                                        <strong>Provisioned:</strong>
                                                                        <FiberManualRecordIcon
                                                                            sx={{
                                                                                color: res.provisioned?.state ? green[500] : red[500],
                                                                                fontSize: "1rem",
                                                                                ml: 1,
                                                                                verticalAlign: "middle",
                                                                            }}
                                                                        />
                                                                    </Typography>
                                                                    <Typography variant="body2">
                                                                        <strong>Last
                                                                            Updated:</strong> {res.provisioned?.mtime || "N/A"}
                                                                    </Typography>
                                                                </Box>
                                                            </AccordionDetails>
                                                        </Accordion>
                                                    );
                                                })}
                                            </Box>
                                        </AccordionDetails>
                                    </Accordion>
                                )}
                            </Box>
                        </Paper>
                    );
                })}

                {/* DIALOGS */}
                <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Confirm Freeze</DialogTitle>
                    <DialogContent>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={checkboxes.failover}
                                    onChange={(e) => setCheckboxes({failover: e.target.checked})}
                                />
                            }
                            label="I understand that the selected service orchestration will be paused."
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            color="primary"
                            disabled={!checkboxes.failover}
                            onClick={handleDialogConfirm}
                        >
                            Confirm
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={stopDialogOpen} onClose={() => setStopDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Confirm Stop</DialogTitle>
                    <DialogContent>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={stopCheckbox}
                                    onChange={(e) => setStopCheckbox(e.target.checked)}
                                />
                            }
                            label="I understand that this may interrupt services."
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setStopDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            color="error"
                            disabled={!stopCheckbox}
                            onClick={handleDialogConfirm}
                        >
                            Stop
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={resourceDialogOpen} onClose={() => setResourceDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Confirm Unprovision</DialogTitle>
                    <DialogContent>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={resourceConfirmChecked}
                                    onChange={(e) => setResourceConfirmChecked(e.target.checked)}
                                />
                            }
                            label="I understand that data will be lost."
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setResourceDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            color="error"
                            disabled={!resourceConfirmChecked}
                            onClick={handleDialogConfirm}
                        >
                            Confirm
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={simpleDialogOpen} onClose={() => setSimpleDialogOpen(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>Confirm {pendingAction?.action}</DialogTitle>
                    <DialogContent>
                        <Typography>
                            Are you sure you want to <strong>{pendingAction?.action}</strong> on{" "}
                            {pendingAction?.batch === "nodes"
                                ? "selected nodes"
                                : pendingAction?.node && !pendingAction?.rid
                                    ? `node ${pendingAction.node}`
                                    : pendingAction?.batch === "resources"
                                        ? `selected resources of node ${pendingAction.node}`
                                        : pendingAction?.rid
                                            ? `resource ${pendingAction.rid} of node ${pendingAction.node}`
                                            : "the object"}
                            ?
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setSimpleDialogOpen(false)}>Cancel</Button>
                        <Button variant="contained" onClick={handleDialogConfirm}>
                            Confirm
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* SNACKBAR */}
                <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={closeSnackbar}>
                    <Alert onClose={closeSnackbar} severity={snackbar.severity} variant="filled">
                        {snackbar.message}
                    </Alert>
                </Snackbar>

                {/* NODE ACTIONS MENU */}
                <Menu
                    anchorEl={nodesActionsAnchor}
                    open={Boolean(nodesActionsAnchor)}
                    onClose={handleNodesActionsClose}
                >
                    {NODE_ACTIONS.map((action) => (
                        <MenuItem key={action} onClick={() => handleBatchNodeActionClick(action)}>
                            {action}
                        </MenuItem>
                    ))}
                </Menu>

                {/* INDIVIDUAL NODE ACTIONS MENU */}
                <Menu
                    anchorEl={individualNodeMenuAnchor}
                    open={Boolean(individualNodeMenuAnchor)}
                    onClose={() => setIndividualNodeMenuAnchor(null)}
                >
                    {NODE_ACTIONS.map((action) => (
                        <MenuItem key={action} onClick={() => handleIndividualNodeActionClick(action)}>
                            {action}
                        </MenuItem>
                    ))}
                </Menu>

                {/* RESOURCE ACTIONS MENU */}
                <Menu
                    anchorEl={resourcesActionsAnchor}
                    open={Boolean(resourcesActionsAnchor)}
                    onClose={handleResourcesActionsClose}
                >
                    {RESOURCE_ACTIONS.map((action) => (
                        <MenuItem key={action} onClick={() => handleBatchResourceActionClick(action)}>
                            {action}
                        </MenuItem>
                    ))}
                </Menu>

                {/* INDIVIDUAL RESOURCE ACTIONS MENU */}
                <Menu
                    anchorEl={resourceMenuAnchor}
                    open={Boolean(resourceMenuAnchor)}
                    onClose={() => setResourceMenuAnchor(null)}
                >
                    {RESOURCE_ACTIONS.map((action) => {
                        const handleClick = () => {
                            setPendingAction({action, node: resGroupNode, rid: currentResourceId});
                            setSimpleDialogOpen(true);
                            setResourceMenuAnchor(null);
                            setCurrentResourceId(null);
                        };

                        return (
                            <MenuItem key={action} onClick={handleClick}>
                                {action}
                            </MenuItem>
                        );
                    })}
                </Menu>
            </Box>
        </Box>
    );
};

export default ObjectDetail;