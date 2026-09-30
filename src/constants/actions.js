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
    WaterDrop,
    Inventory,
    Storage,
    Archive,
    Psychology,
    Description,
    Terminal,
    RemoveCircleOutline,
    Search,
    PowerSettingsNew,
} from "@mui/icons-material";

export const OBJECT_ACTIONS = [
    {name: "start", icon: <PlayArrow sx={{fontSize: 24}}/>},
    {name: "stop", icon: <Stop sx={{fontSize: 24}}/>},
    {name: "restart", icon: <RestartAlt sx={{fontSize: 24}}/>},
    {name: "freeze", icon: <AcUnit sx={{fontSize: 24}}/>},
    {name: "unfreeze", icon: <LockOpen sx={{fontSize: 24}}/>},
    {name: "provision", icon: <Settings sx={{fontSize: 24}}/>},
    {name: "unprovision", icon: <Block sx={{fontSize: 24}}/>},
    {name: "switch", icon: <SwapHoriz sx={{fontSize: 24}}/>},
    {name: "giveback", icon: <Undo sx={{fontSize: 24}}/>},
    {name: "abort", icon: <Cancel sx={{fontSize: 24}}/>},
    {name: "delete", icon: <Delete sx={{fontSize: 24}}/>, color: "red"},
    {name: "purge", icon: <CleaningServices sx={{fontSize: 24}}/>, color: "red"},
];

export const INSTANCE_ACTIONS = [
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
    {name: 'console', icon: <Terminal/>},
];

export const NODE_ACTIONS = [

    // Node-level actions
    {name: "freeze", icon: <AcUnit sx={{fontSize: 24}}/>, endpoint: "action/freeze"},
    {name: "unfreeze", icon: <LockOpen sx={{fontSize: 24}}/>, endpoint: "action/unfreeze"},
    {name: "abort", icon: <Cancel sx={{fontSize: 24}}/>, endpoint: "action/abort"},
    {name: "clear", icon: <CleaningServices sx={{fontSize: 24}}/>, endpoint: "action/clear"},
    {name: "dequeue", icon: <RemoveCircleOutline sx={{fontSize: 24}}/>, endpoint: "action/dequeue"},
    {name: "drain", icon: <WaterDrop sx={{fontSize: 24}}/>, endpoint: "action/drain"},
    {name: "scsi scan", icon: <Search sx={{fontSize: 24}}/>, endpoint: "action/scsi/scan"},
    {name: "asset", icon: <Inventory sx={{fontSize: 24}}/>, endpoint: "action/push/asset"},
    {name: "disk", icon: <Storage sx={{fontSize: 24}}/>, endpoint: "action/push/disk"},
    {name: "pkg", icon: <Archive sx={{fontSize: 24}}/>, endpoint: "action/push/pkg"},
    {name: "capabilities", icon: <Psychology sx={{fontSize: 24}}/>, endpoint: "action/scan/capabilities"},
    {name: "sysreport", icon: <Description sx={{fontSize: 24}}/>, endpoint: "action/sysreport"},

    // Daemon-level actions
    {name: "restart daemon", icon: <RestartAlt sx={{fontSize: 24}}/>, endpoint: "daemon/action/restart"},
    {name: "stop", icon: <Stop sx={{fontSize: 24}}/>, endpoint: "daemon/action/stop", color: "red"},
    {name: "shutdown", icon: <PowerSettingsNew sx={{fontSize: 24}}/>, endpoint: "daemon/action/shutdown", color: "red"},
];
