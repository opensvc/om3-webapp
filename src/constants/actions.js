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
    PowerOff,
    PauseCircleFilled,
    FastForward,
    FastRewind,
    Restore,
    Sync,
    CloudDownload,
    Info,
    Assignment,
    ToggleOn,
    ToggleOff
} from "@mui/icons-material";

export const OBJECT_ACTIONS = [
    {name: "start", icon: <PlayArrow sx={{fontSize: 24}}/>, endpoint: "action/start"},
    {name: "stop", icon: <Stop sx={{fontSize: 24}}/>, endpoint: "action/stop"},
    {name: "restart", icon: <RestartAlt sx={{fontSize: 24}}/>, endpoint: "action/restart"},
    {name: "freeze", icon: <AcUnit sx={{fontSize: 24}}/>, endpoint: "action/freeze"},
    {name: "unfreeze", icon: <LockOpen sx={{fontSize: 24}}/>, endpoint: "action/unfreeze"},
    {name: "provision", icon: <Settings sx={{fontSize: 24}}/>, endpoint: "action/provision"},
    {name: "unprovision", icon: <Block sx={{fontSize: 24}}/>, endpoint: "action/unprovision"},
    {name: "switch", icon: <SwapHoriz sx={{fontSize: 24}}/>, endpoint: "action/switch"},
    {name: "giveback", icon: <Undo sx={{fontSize: 24}}/>, endpoint: "action/giveback"},
    {name: "abort", icon: <Cancel sx={{fontSize: 24}}/>, endpoint: "action/abort"},
    {name: "enable", icon: <ToggleOn sx={{fontSize: 24}}/>, endpoint: "enable", kinds: ["svc"]},
    {name: "disable", icon: <ToggleOff sx={{fontSize: 24}}/>, endpoint: "disable", kinds: ["svc"]},
    {name: "delete", icon: <Delete sx={{fontSize: 24}}/>, endpoint: "action/delete", color: "red"},
    {name: "purge", icon: <CleaningServices sx={{fontSize: 24}}/>, endpoint: "action/purge", color: "red"},
];

export const INSTANCE_ACTIONS = [
    // Lifecycle
    {name: "start", icon: <PlayArrow sx={{fontSize: 24}}/>, endpoint: "start"},
    {name: "stop", icon: <Stop sx={{fontSize: 24}}/>, endpoint: "stop"},
    {name: "restart", icon: <RestartAlt sx={{fontSize: 24}}/>, endpoint: "restart"},
    {name: "run", icon: <PlayCircleFilled sx={{fontSize: 24}}/>, endpoint: "run"},
    {name: "boot", icon: <PowerSettingsNew sx={{fontSize: 24}}/>, endpoint: "boot"},
    {name: "shutdown", icon: <PowerOff sx={{fontSize: 24}}/>, endpoint: "shutdown"},
    {name: "start standby", icon: <PauseCircleFilled sx={{fontSize: 24}}/>, endpoint: "startstandby"},

    // Freeze state
    {name: "freeze", icon: <AcUnit sx={{fontSize: 24}}/>, endpoint: "freeze"},
    {name: "unfreeze", icon: <LockOpen sx={{fontSize: 24}}/>, endpoint: "unfreeze"},

    // Provisioning
    {name: "provision", icon: <Settings sx={{fontSize: 24}}/>, endpoint: "provision"},
    {name: "unprovision", icon: <Block sx={{fontSize: 24}}/>, endpoint: "unprovision"},

    // Replication
    {name: "prstart", icon: <FastForward sx={{fontSize: 24}}/>, endpoint: "prstart"},
    {name: "prstop", icon: <FastRewind sx={{fontSize: 24}}/>, endpoint: "prstop"},
    {name: "sync ingest", icon: <CloudDownload sx={{fontSize: 24}}/>, endpoint: "sync/ingest"},

    // Placement groups
    {name: "pg reset", icon: <Restore sx={{fontSize: 24}}/>, endpoint: "pg/reset"},
    {name: "pg update", icon: <Sync sx={{fontSize: 24}}/>, endpoint: "pg/update"},

    // Info
    {name: "info", icon: <Info sx={{fontSize: 24}}/>, endpoint: "info"},
    {name: "status", icon: <Assignment sx={{fontSize: 24}}/>, endpoint: "status"},

    // Destructive
    {name: "delete", icon: <Delete sx={{fontSize: 24}}/>, endpoint: "delete", color: "red"},
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
