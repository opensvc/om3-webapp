// constants/actions.js
import {
    PlayArrow,
    Stop,
    RestartAlt,
    AcUnit,
    LockOpen,
    Delete,
    Settings,
    Block,
    CleaningServices,
    SwapHoriz,
    Undo,
    Cancel,
    PlayCircleFilled,
} from "@mui/icons-material";

export const OBJECT_ACTIONS = [
    {name: "start", icon: <PlayArrow sx={{fontSize: 24}}/>},
    {name: "stop", icon: <Stop sx={{fontSize: 24}}/>},
    {name: "restart", icon: <RestartAlt sx={{fontSize: 24}}/>},
    {name: "freeze", icon: <AcUnit sx={{fontSize: 24}}/>},
    {name: "unfreeze", icon: <LockOpen sx={{fontSize: 24}}/>},
    {name: "delete", icon: <Delete sx={{fontSize: 24}}/>},
    {name: "provision", icon: <Settings sx={{fontSize: 24}}/>},
    {name: "unprovision", icon: <Block sx={{fontSize: 24}}/>},
    {name: "purge", icon: <CleaningServices sx={{fontSize: 24}}/>},
    {name: "switch", icon: <SwapHoriz sx={{fontSize: 24}}/>},
    {name: "giveback", icon: <Undo sx={{fontSize: 24}}/>},
    {name: "abort", icon: <Cancel sx={{fontSize: 24}}/>},
];

export const NODE_ACTIONS = [
    {name: "start", icon: <PlayArrow sx={{fontSize: 24}}/>},
    {name: "stop", icon: <Stop sx={{fontSize: 24}}/>},
    {name: "restart", icon: <RestartAlt sx={{fontSize: 24}}/>},
    {name: "freeze", icon: <AcUnit sx={{fontSize: 24}}/>},
    {name: "unfreeze", icon: <LockOpen sx={{fontSize: 24}}/>},
    {name: "provision", icon: <Settings sx={{fontSize: 24}}/>},
    {name: "unprovision", icon: <Block sx={{fontSize: 24}}/>},
    {name: "run", icon: <PlayCircleFilled sx={{fontSize: 24}}/>},
];

export const RESOURCE_ACTIONS = [
    {name: "start", icon: <PlayArrow sx={{fontSize: 24}}/>},
    {name: "stop", icon: <Stop sx={{fontSize: 24}}/>},
    {name: "restart", icon: <RestartAlt sx={{fontSize: 24}}/>},
    {name: "run", icon: <PlayCircleFilled sx={{fontSize: 24}}/>},
];
