import React, {useCallback, useEffect, useRef, useState} from "react";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Link,
    Typography,
} from "@mui/material";
import {Terminal} from "@xterm/xterm";
import {FitAddon} from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
    CONSOLE_REASON_ERROR,
    consoleCertificateUrl,
    consoleUrl,
    openConsoleSession,
    requestConsoleTicket,
} from "../services/console-service.js";
import logger from "../utils/logger.js";

export const CONSOLE_STATUS = {
    connecting: "connecting",
    open: "open",
    ended: "ended",
    failed: "failed",
};

/**
 * A terminal attached to a console session of a container resource.
 *
 * The session is opened when the dialog opens, and ended when it closes: a
 * session lasts as long as its client connection.
 *
 * @param {{
 *   open: boolean,
 *   target: null | {node: string, namespace: string, kind: string, name: string, rid?: string},
 *   onClose: () => void,
 * }} props
 */
const ConsoleTerminal = ({open, target, onClose}) => {
    // The element the terminal is drawn in is kept in a state, not in a ref:
    // the dialog mounts its content after it opened, and the session starts
    // when there is something to draw the terminal in.
    const [container, setContainer] = useState(/** @type {HTMLDivElement | null} */ (null));
    const fitRef = useRef(/** @type {any} */ (null));
    const [status, setStatus] = useState(CONSOLE_STATUS.connecting);
    const [message, setMessage] = useState("");
    const [certificateUrl, setCertificateUrl] = useState("");

    const node = target?.node;
    const namespace = target?.namespace;
    const kind = target?.kind;
    const name = target?.name;
    const rid = target?.rid;

    const fit = useCallback(() => {
        try {
            fitRef.current?.fit();
        } catch (err) {
            logger.warn("[ConsoleTerminal] fit failed:", err);
        }
    }, []);

    useEffect(() => {
        if (!open || !container || !node || !name) {
            return undefined;
        }
        let cancelled = false;
        let session = null;

        setStatus(CONSOLE_STATUS.connecting);
        setMessage("");
        setCertificateUrl("");

        const term = new Terminal({cursorBlink: true, fontSize: 14, scrollback: 5000});
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        fitRef.current = fitAddon;
        term.open(container);
        fit();

        const fail = (text) => {
            setStatus(CONSOLE_STATUS.failed);
            setMessage(text);
        };

        const dataListener = term.onData((data) => session?.send(data));
        const resizeListener = term.onResize(({cols, rows}) => session?.resize(cols, rows));
        window.addEventListener("resize", fit);

        const token = localStorage.getItem("authToken");
        if (!token) {
            fail("Auth token not found.");
        } else {
            requestConsoleTicket({node, namespace, kind, name, rid, token})
                .then((ticket) => {
                    if (cancelled) {
                        return;
                    }
                    const url = consoleUrl(ticket);
                    session = openConsoleSession(url, {
                        onOpen: () => {
                            setStatus(CONSOLE_STATUS.open);
                            session.resize(term.cols, term.rows);
                            term.focus();
                        },
                        onData: (bytes) => term.write(bytes),
                        onEnd: ({opened, exit}) => {
                            if (cancelled) {
                                return;
                            }
                            if (exit && exit.reason === CONSOLE_REASON_ERROR) {
                                fail(exit.text || "The console session failed.");
                            } else if (exit) {
                                setStatus(CONSOLE_STATUS.ended);
                                setMessage(`Session ended (exit code ${exit.code}).`);
                            } else if (!opened) {
                                // The browser does not say why a websocket
                                // is refused. A certificate it does not
                                // trust on the console port is the usual
                                // reason, and one the user can fix.
                                setCertificateUrl(consoleCertificateUrl(url));
                                fail("The console could not be reached.");
                            } else {
                                fail("The console connection was lost.");
                            }
                        },
                    });
                })
                .catch((err) => {
                    if (!cancelled) {
                        fail(`Failed to open console: ${err.message}`);
                    }
                });
        }

        return () => {
            cancelled = true;
            window.removeEventListener("resize", fit);
            dataListener?.dispose();
            resizeListener?.dispose();
            session?.close();
            term.dispose();
            fitRef.current = null;
        };
    }, [open, container, node, namespace, kind, name, rid, fit]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            TransitionProps={{onEntered: fit}}
            aria-labelledby="console-terminal-title"
        >
            <DialogTitle id="console-terminal-title">
                Console {rid ? `${rid} ` : ""}{node ? `on ${node}` : ""}
            </DialogTitle>
            <DialogContent>
                {status === CONSOLE_STATUS.connecting && (
                    <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
                        Opening console...
                    </Typography>
                )}
                {status === CONSOLE_STATUS.ended && (
                    <Alert severity="info" sx={{mb: 1}}>{message}</Alert>
                )}
                {status === CONSOLE_STATUS.failed && (
                    <Alert severity="error" sx={{mb: 1}}>
                        {message}
                        {certificateUrl && (
                            <>
                                {" "}If the certificate of the console port is not trusted by this browser,
                                open{" "}
                                <Link href={certificateUrl} target="_blank" rel="noopener noreferrer">
                                    {certificateUrl}
                                </Link>
                                {" "}to accept it, then open the console again.
                            </>
                        )}
                    </Alert>
                )}
                <Box
                    ref={setContainer}
                    data-testid="console-terminal"
                    sx={{height: "60vh", backgroundColor: "#000", padding: "4px"}}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConsoleTerminal;
