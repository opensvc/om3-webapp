import React, {forwardRef, useState} from "react";
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
    const [isHovered, setIsHovered] = useState(false);

    if (!node) {
        logger.error("Node name is required");
        return null;
    }

    const encapData = nodeData?.encap || {};
    const {avail, frozen, state} = getNodeState(node);
    const isInstanceNotProvisioned = nodeData?.provisioned !== undefined ? !parseProvisionedState(nodeData.provisioned) : false;

    const handleCardClick = (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.no-click')) {
            return;
        }
        if (onViewInstance && typeof onViewInstance === 'function') {
            onViewInstance(node);
        }
    };

    return (
        <BoxWithRef
            sx={{
                mb: 2,
                display: "flex",
                flexDirection: "column",
                width: "100%",
                maxWidth: "1400px",
                cursor: onViewInstance ? 'pointer' : 'default',
                transition: 'background-color 0.2s ease',
                position: 'relative',
                p: 2,
                backgroundColor: isHovered && onViewInstance ? 'action.hover' : 'transparent',
                borderRadius: 1,
                '&:hover': onViewInstance ? {
                    backgroundColor: 'action.hover',
                } : {},
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleCardClick}
        >
            <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                <Box sx={{display: "flex", alignItems: "center", gap: 1, flexWrap: 'wrap'}}>
                    <Box onClick={(e) => e.stopPropagation()} className="no-click">
                        <Checkbox
                            checked={selectedNodes.includes(node)}
                            onChange={() => toggleNode(node)}
                            aria-label={`Select node ${node}`}
                        />
                    </Box>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                        <Typography variant="h6">
                            {node}
                        </Typography>
                        {isHovered && onViewInstance && (
                            <Typography
                                variant="body2"
                                color="primary"
                                sx={{
                                    fontStyle: 'italic',
                                    ml: 1,
                                    opacity: 0.8
                                }}
                            >
                                (view resources)
                            </Typography>
                        )}
                    </Box>
                </Box>
                <Box sx={{display: "flex", alignItems: "center", gap: 2}} className="no-click">
                    {/* Bouton pour voir les logs de l'instance */}
                    <Tooltip title="View instance logs">
                        <IconButtonWithRef
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenLogs(node, resolvedInstanceName);
                            }}
                            color="primary"
                            aria-label={`View logs for instance ${resolvedInstanceName || node}`}
                        >
                            <ArticleIcon/>
                        </IconButtonWithRef>
                    </Tooltip>

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
                            e.stopPropagation();
                            e.persist();
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
        </BoxWithRef>
    );
};

export default NodeCard;
