import React, {forwardRef} from "react";
import {
    Box,
    Typography,
    Tooltip,
    Checkbox,
    IconButton,
} from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import ArticleIcon from "@mui/icons-material/Article";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {grey, blue, red} from "@mui/material/colors";
import logger from '../utils/logger.js';

const BoxWithRef = forwardRef((props, ref) => (
    <Box ref={ref} {...props} />
));
BoxWithRef.displayName = 'BoxWithRef';

const IconButtonWithRef = forwardRef((props, ref) => (
    <IconButton ref={ref} {...props} />
));
IconButtonWithRef.displayName = 'IconButtonWithRef';

const NodeCard = ({
                      node,
                      nodeData = {},
                      selectedNodes = [],
                      toggleNode = () => logger.warn("toggleNode not provided"),
                      actionInProgress = false,
                      setIndividualNodeMenuAnchor = () => logger.warn("setIndividualNodeMenuAnchor not provided"),
                      setCurrentNode = () => logger.warn("setCurrentNode not provided"),
                      individualNodeMenuAnchorRef = null,
                      getColor = () => grey[500],
                      getNodeState = () => ({avail: "unknown", frozen: "unfrozen", state: null}),
                      parseProvisionedState = (state) => !!state,
                      instanceName,
                      onOpenLogs = () => logger.warn("onOpenLogs not provided"),
                      onViewInstance,
                  }) => {
    const resolvedInstanceName = instanceName || nodeData?.instanceName || nodeData?.name || node;

    if (!node) {
        logger.error("Node name is required");
        return null;
    }

    const encapData = nodeData?.encap || {};
    const {avail, frozen, state} = getNodeState(node);
    const isInstanceNotProvisioned = nodeData?.provisioned !== undefined ? !parseProvisionedState(nodeData.provisioned) : false;

    return (
        <BoxWithRef
            sx={{
                mb: 2,
                display: "flex",
                flexDirection: "column",
                gap: 1,
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
                        {/* Bouton pour voir les logs de l'instance */}
                        <Tooltip title="View instance logs">
                            <IconButtonWithRef
                                onClick={() => onOpenLogs(node, resolvedInstanceName)}
                                color="primary"
                                aria-label={`View logs for instance ${resolvedInstanceName || node}`}
                            >
                                <ArticleIcon/>
                            </IconButtonWithRef>
                        </Tooltip>

                        {/* Bouton pour naviguer vers la vue instance détaillée */}
                        {onViewInstance && (
                            <Tooltip title="View instance details">
                                <IconButtonWithRef
                                    onClick={() => onViewInstance(node)}
                                    color="primary"
                                    aria-label={`View instance details for ${node}`}
                                >
                                    <OpenInNewIcon/>
                                </IconButtonWithRef>
                            </Tooltip>
                        )}

                        <Tooltip title={avail || "unknown"}>
                            <FiberManualRecordIcon
                                sx={{
                                    fontSize: "1.2rem",
                                    color: typeof getColor === "function" ? getColor(avail) : grey[500]
                                }}
                            />
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
                        <IconButtonWithRef
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
                        </IconButtonWithRef>
                    </Box>
                </Box>
            </Box>
        </BoxWithRef>
    );
};

export default NodeCard;
