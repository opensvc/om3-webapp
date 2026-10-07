import React, {useState, useEffect, useCallback, useId} from "react";
import {Dialog} from "../ui/components/Dialog";
import {Button, IconButton} from "../ui/components/Button";
import {Field, Input, Textarea} from "../ui/components/Field";
import {Table, HeaderRow, HeaderCell, Row, Cell} from "../ui/components/Table";
import {Alert} from "../ui/components/Alert";
import {Spinner} from "../ui/components/Spinner";
import {EyeIcon, EyeOffIcon, FileIcon, KeyIcon, LockIcon, PencilIcon, PlusIcon, TrashIcon} from "../ui/icons";
import {SECRET_REVEAL_MS, useAutoHide} from "../ui/lib/reveal";
import {URL_OBJECT} from "../config/apiPath.js";
import {getResponseErrorMessage} from "../services/api.jsx";
import logger from '../utils/logger.js';
import {parseObjectPath} from '../utils/objectUtils';

const getAuthToken = () => {
    const token = localStorage.getItem("authToken");
    if (!token) {
        logger.error("Auth token not found.");
        return null;
    }
    return token;
};

const buildObjectUrl = (decodedObjectName) => {
    const {namespace, kind, name} = parseObjectPath(decodedObjectName);
    return `${URL_OBJECT}/${namespace}/${kind}/${name}`;
};

const formatResponseError = async (response, defaultMessage) => {
    const serverError = await getResponseErrorMessage(response);
    return `${defaultMessage}${serverError ? ` - ${serverError}` : ''}`;
};

const parseBlobContent = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let isText = true;
    let textContent = "";
    try {
        textContent = new TextDecoder('utf-8', {fatal: true}).decode(uint8Array);
        for (let i = 0; i < textContent.length; i++) {
            const code = textContent.charCodeAt(i);
            if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
                isText = false;
                break;
            }
        }
    } catch (e) {
        isText = false;
    }

    if (isText && textContent.length > 0) {
        return {type: "text", content: textContent};
    } else {
        const hexLines = [];
        for (let i = 0; i < uint8Array.length; i += 16) {
            const chunk = uint8Array.slice(i, i + 16);
            const hex = Array.from(chunk)
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
            const ascii = Array.from(chunk)
                .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
                .join('');
            hexLines.push(`${i.toString(16).padStart(8, '0')}  ${hex.padEnd(48, ' ')}  ${ascii}`);
        }
        return {type: "binary", content: hexLines.join('\n')};
    }
};


const RADIO = "h-4 w-4 accent-(--accent)";

const KeyFormDialog = ({
                           open,
                           onClose,
                           onSubmit,
                           mode,
                           initialName = "",
                           initialContent = "",
                           initialInputMode = "empty",
                           title,
                           allowEmpty = false,
                           loading = false,
                           initialLoading = false,
                       }) => {
    const [name, setName] = useState(initialName);
    const [inputMode, setInputMode] = useState(initialInputMode);
    const [file, setFile] = useState(null);
    const [text, setText] = useState(initialContent);
    const [fullscreen, setFullscreen] = useState(false);
    const radioName = useId();

    useEffect(() => {
        if (open) {
            setName(initialName);
            setInputMode(initialInputMode);
            setFile(null);
            setText(initialContent);
            setFullscreen(false);
        }
    }, [open, initialName, initialInputMode, initialContent]);

    const handleSubmit = () => {
        if (!name) return;
        let contentBlob = null;
        if (inputMode === "empty") {
            contentBlob = new Blob([], {type: "application/octet-stream"});
        } else if (inputMode === "file" && file) {
            contentBlob = file;
        } else if (inputMode === "text") {
            contentBlob = new Blob([text], {type: "application/octet-stream"});
        } else {
            return;
        }
        onSubmit({name, contentBlob});
    };

    const isSubmitDisabled = () => {
        if (!name) return true;
        return inputMode === "file" && !file;

    };

    const fileUploadId = `${mode}-key-file-upload`;

    const close = () => {
        onClose();
        setFullscreen(false);
    };

    const radio = (value, label) => (
        <label key={value} className="flex items-center gap-2">
            <input
                type="radio"
                name={radioName}
                value={value}
                checked={inputMode === value}
                onChange={(e) => setInputMode(e.target.value)}
                disabled={loading}
                className={RADIO}
            />
            {label}
        </label>
    );

    const textArea = (control) => (
        <Textarea
            {...control}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={loading}
            placeholder="Enter the text content for this key..."
            rows={fullscreen ? 24 : 8}
            className={fullscreen ? "h-[60vh] resize-none font-mono text-data" : "resize-y font-mono text-data"}
        />
    );

    return (
        <Dialog
            open={open}
            onClose={close}
            title={title}
            size={fullscreen ? "lg" : "md"}
            footer={
                <>
                    <Button onClick={close} disabled={loading}>Cancel</Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={loading || isSubmitDisabled() || initialLoading}
                    >
                        {mode === 'create' ? 'Create' : 'Update'}
                    </Button>
                </>
            }
        >
            {initialLoading ? (
                <div className="flex justify-center p-6">
                    <Spinner label="Loading key content"/>
                </div>
            ) : (
                <>
                    {!fullscreen && (
                        <>
                            <Field label="Key Name">
                                {(control) => (
                                    <Input
                                        {...control}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        disabled={loading}
                                    />
                                )}
                            </Field>
                            <fieldset className="space-y-1">
                                <legend className="mb-1 font-medium">Input Mode</legend>
                                {allowEmpty && radio("empty", "Empty key (no content)")}
                                {radio("file", "Upload from file")}
                                <div className="flex items-center gap-2">
                                    {radio("text", "Enter text directly")}
                                    {inputMode === "text" && (
                                        <Button variant="ghost" size="sm" onClick={() => setFullscreen(true)}>
                                            Full screen
                                        </Button>
                                    )}
                                </div>
                            </fieldset>
                        </>
                    )}

                    {inputMode === "file" && !fullscreen && (
                        <div className="flex items-center gap-3">
                            <input
                                id={fileUploadId}
                                type="file"
                                className="peer sr-only"
                                onChange={(e) => setFile(e.target.files[0])}
                                disabled={loading}
                            />
                            <label
                                htmlFor={fileUploadId}
                                className={
                                    loading
                                        ? "inline-flex h-8 items-center rounded-(--radius-control) border border-line bg-surface-raised px-3 font-medium opacity-60"
                                        : "inline-flex h-8 cursor-pointer items-center rounded-(--radius-control) border border-line bg-surface-raised px-3 font-medium hover:bg-surface-sunken peer-focus-visible:outline-2 peer-focus-visible:outline-(--focus-ring)"
                                }
                            >
                                Choose File
                            </label>
                            <span className={file ? "text-ink" : "text-ink-muted"}>
                                {file ? file.name : "No file selected"}
                            </span>
                        </div>
                    )}

                    {inputMode === "text" && (
                        fullscreen ? (
                            <>
                                <div className="flex justify-end">
                                    <Button variant="ghost" size="sm" onClick={() => setFullscreen(false)}>
                                        Exit full screen
                                    </Button>
                                </div>
                                {textArea({"aria-label": "Key Content"})}
                            </>
                        ) : (
                            <Field label="Key Content">{textArea}</Field>
                        )
                    )}
                </>
            )}
        </Dialog>
    );
};

const KeysSection = ({decodedObjectName, openSnackbar}) => {
    const {kind} = parseObjectPath(decodedObjectName);
    const isSecret = kind === "sec";
    const showKeys = ["cfg", "sec"].includes(kind);

    const [keys, setKeys] = useState([]);
    const [keysLoading, setKeysLoading] = useState(false);
    const [keysError, setKeysError] = useState(null);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const [viewDialogOpen, setViewDialogOpen] = useState(false);
    const [keyToDelete, setKeyToDelete] = useState(null);
    const [keyToView, setKeyToView] = useState(null);
    const [keyViewContent, setKeyViewContent] = useState(null);
    const [keyViewLoading, setKeyViewLoading] = useState(false);
    const [revealSecret, setRevealSecret] = useState(false);
    // A revealed secret is masked again on its own after a few seconds.
    useAutoHide(revealSecret, () => setRevealSecret(false));
    const [actionLoading, setActionLoading] = useState(false);

    const [updateInitialName, setUpdateInitialName] = useState("");
    const [updateInitialContent, setUpdateInitialContent] = useState("");
    const [updateInitialInputMode, setUpdateInitialInputMode] = useState("file");
    const [updateContentLoading, setUpdateContentLoading] = useState(false);
    const titleId = useId();

    const fetchKeys = useCallback(async () => {
        const {kind} = parseObjectPath(decodedObjectName);
        if (!["cfg", "sec"].includes(kind)) {
            setKeys([]);
            return;
        }

        const token = getAuthToken();
        if (!token) {
            setKeysError("Auth token not found.");
            return;
        }

        setKeysLoading(true);
        setKeysError(null);
        try {
            const baseUrl = buildObjectUrl(decodedObjectName);
            const url = `${baseUrl}/data/keys`;
            const response = await fetch(url, {
                headers: {Authorization: `Bearer ${token}`},
                cache: "no-cache",
            });
            if (!response.ok) {
                const errorMessage = await formatResponseError(response, `Failed to fetch keys: ${response.status}`);
                setKeysError(errorMessage);
                openSnackbar(errorMessage, "error");
                return;
            }
            const data = await response.json();
            setKeys(data.items || []);
        } catch (err) {
            logger.error(`💥 [fetchKeys] Error: ${err.message}`);
            setKeysError(err.message);
        } finally {
            setKeysLoading(false);
        }
    }, [decodedObjectName, openSnackbar]);

    const fetchKeyContent = useCallback(async (keyName) => {
        const token = getAuthToken();
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return {type: 'error', content: null};
        }

        try {
            const baseUrl = buildObjectUrl(decodedObjectName);
            const url = `${baseUrl}/data/key?name=${encodeURIComponent(keyName)}`;
            const response = await fetch(url, {
                headers: {Authorization: `Bearer ${token}`},
            });
            if (!response.ok) {
                const errorMessage = await formatResponseError(response, `Failed to fetch key content: ${response.status}`);
                openSnackbar(errorMessage, "error");
                return {type: 'error', content: null};
            }

            let blob;
            if (typeof response.blob === 'function') {
                blob = await response.blob();
            } else {
                const text = await response.text();
                blob = new Blob([text], {type: 'text/plain'});
            }
            return await parseBlobContent(blob);
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
            return {type: 'error', content: null};
        }
    }, [decodedObjectName, openSnackbar]);

    const handleDeleteKey = async () => {
        if (!keyToDelete) return;
        const token = getAuthToken();
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            setDeleteDialogOpen(false);
            return;
        }

        setActionLoading(true);
        openSnackbar(`Deleting key ${keyToDelete}…`, "info");
        try {
            const baseUrl = buildObjectUrl(decodedObjectName);
            const url = `${baseUrl}/data/key?name=${encodeURIComponent(keyToDelete)}`;
            const response = await fetch(url, {
                method: "DELETE",
                headers: {Authorization: `Bearer ${token}`},
            });
            if (!response.ok) {
                const errorMessage = await formatResponseError(response, `Failed to delete key: ${response.status}`);
                openSnackbar(errorMessage, "error");
                return;
            }
            openSnackbar(`Key '${keyToDelete}' deleted successfully`);
            await fetchKeys();
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionLoading(false);
            setDeleteDialogOpen(false);
            setKeyToDelete(null);
        }
    };

    const handleCreateKey = async ({name, contentBlob}) => {
        const token = getAuthToken();
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            setCreateDialogOpen(false);
            return;
        }

        setActionLoading(true);
        openSnackbar(`Creating key ${name}…`, "info");
        try {
            const baseUrl = buildObjectUrl(decodedObjectName);
            const url = `${baseUrl}/data/key?name=${encodeURIComponent(name)}`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/octet-stream",
                },
                body: contentBlob,
            });
            if (!response.ok) {
                const errorMessage = await formatResponseError(response, `Failed to create key: ${response.status}`);
                openSnackbar(errorMessage, "error");
                return;
            }
            openSnackbar(`Key '${name}' created successfully`);
            await fetchKeys();
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionLoading(false);
            setCreateDialogOpen(false);
        }
    };

    const handleUpdateKey = async ({name, contentBlob}) => {
        const token = getAuthToken();
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            setUpdateDialogOpen(false);
            return;
        }

        setActionLoading(true);
        openSnackbar(`Updating key ${name}…`, "info");
        try {
            const baseUrl = buildObjectUrl(decodedObjectName);
            const url = `${baseUrl}/data/key?name=${encodeURIComponent(name)}`;
            const response = await fetch(url, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/octet-stream",
                },
                body: contentBlob,
            });
            if (!response.ok) {
                const errorMessage = await formatResponseError(response, `Failed to update key: ${response.status}`);
                openSnackbar(errorMessage, "error");
                return;
            }
            openSnackbar(`Key '${name}' updated successfully`);
            await fetchKeys();
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionLoading(false);
            setUpdateDialogOpen(false);
        }
    };

    const handleViewKey = async (keyName) => {
        setKeyToView(keyName);
        setKeyViewLoading(true);
        setViewDialogOpen(true);
        setKeyViewContent(null);
        setRevealSecret(false);

        const result = await fetchKeyContent(keyName);
        if (result.type !== 'error') {
            setKeyViewContent(result);
        } else {
            setViewDialogOpen(false);
        }
        setKeyViewLoading(false);
    };

    const openUpdateDialog = async (keyName) => {
        setUpdateInitialName(keyName);
        setUpdateDialogOpen(true);
        setUpdateInitialContent("");
        setUpdateInitialInputMode("file");

        if (isSecret) {
            // Never fetch secret content to the client
            setUpdateContentLoading(false);
            openSnackbar(
                "Secret content is hidden. Provide new content to update it.",
                "info"
            );
            return;
        }

        setUpdateContentLoading(true);
        const result = await fetchKeyContent(keyName);
        if (result.type === "text") {
            setUpdateInitialContent(result.content);
            setUpdateInitialInputMode("text");
        } else if (result.type === "binary") {
            openSnackbar("Key is binary – please use file upload to update.", "info");
        }
        setUpdateContentLoading(false);
    };

    useEffect(() => {
        if (getAuthToken()) {
            fetchKeys().catch((error) => {
                logger.error("Error in fetchKeys:", error);
            });
        }
    }, [decodedObjectName, fetchKeys]);

    if (!showKeys) return null;

    const hasKeysError = Boolean(keysError);
    const safeKeys = Array.isArray(keys) ? keys : [];

    return (
        <section
            aria-labelledby={titleId}
            className="rounded-(--radius-panel) border border-line bg-surface-raised"
        >
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                <KeyIcon className="text-ink-muted"/>
                <h2 id={titleId} className="font-semibold">
                    {`Object Keys (${safeKeys.length})`}
                </h2>
                <IconButton
                    label="Add new key"
                    className="ml-auto"
                    onClick={() => setCreateDialogOpen(true)}
                    disabled={actionLoading}
                >
                    <PlusIcon/>
                </IconButton>
            </div>

            {(keysLoading || hasKeysError || safeKeys.length === 0) && (
                <div className="space-y-2 p-3">
                    {keysLoading && <Spinner label="Loading keys"/>}
                    {hasKeysError && <Alert>{String(keysError)}</Alert>}
                    {!keysLoading && !hasKeysError && safeKeys.length === 0 && (
                        <p className="text-ink-muted">No keys available.</p>
                    )}
                </div>
            )}
            {!keysLoading && !hasKeysError && safeKeys.length > 0 && (
                <Table aria-label="keys table" className="rounded-none border-0">
                    <thead>
                    <HeaderRow>
                        <HeaderCell>Name</HeaderCell>
                        <HeaderCell>Node</HeaderCell>
                        <HeaderCell align="right">Size</HeaderCell>
                        <HeaderCell align="right">Actions</HeaderCell>
                    </HeaderRow>
                    </thead>
                    <tbody>
                    {safeKeys.map((key) => (
                        <Row key={key.name}>
                            <th scope="row" className="px-2 py-1 text-left font-normal">
                                {key.name}
                            </th>
                            <Cell>{key.node}</Cell>
                            <Cell numeric className="whitespace-nowrap">{`${key.size} bytes`}</Cell>
                            <Cell align="right" className="whitespace-nowrap">
                                <IconButton
                                    size="sm"
                                    label={`View key ${key.name}`}
                                    onClick={() => handleViewKey(key.name)}
                                    disabled={actionLoading}
                                >
                                    <FileIcon/>
                                </IconButton>
                                <IconButton
                                    size="sm"
                                    label={`Edit key ${key.name}`}
                                    onClick={() => openUpdateDialog(key.name)}
                                    disabled={actionLoading}
                                >
                                    <PencilIcon/>
                                </IconButton>
                                <IconButton
                                    size="sm"
                                    label={`Delete key ${key.name}`}
                                    className="hover:text-state-down"
                                    onClick={() => {
                                        setKeyToDelete(key.name);
                                        setDeleteDialogOpen(true);
                                    }}
                                    disabled={actionLoading}
                                >
                                    <TrashIcon/>
                                </IconButton>
                            </Cell>
                        </Row>
                    ))}
                    </tbody>
                </Table>
            )}

            <Dialog
                open={viewDialogOpen}
                onClose={() => setViewDialogOpen(false)}
                title={`View Key: ${keyToView ?? ""}`}
                size="lg"
                footer={<Button onClick={() => setViewDialogOpen(false)}>Close</Button>}
            >
                {keyViewLoading && (
                    <div className="flex justify-center p-6">
                        <Spinner label="Loading key content"/>
                    </div>
                )}
                {!keyViewLoading && keyViewContent && (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-data text-ink-muted">
                                {`Type: ${keyViewContent.type === "text" ? "Text" : "Binary (Hex View)"}`}
                                {isSecret && revealSecret && ` · Shown for ${SECRET_REVEAL_MS / 1000} seconds.`}
                            </p>
                            {isSecret && (
                                <IconButton
                                    size="sm"
                                    label={revealSecret ? "Hide secret" : "Reveal secret"}
                                    onClick={() => setRevealSecret(v => !v)}
                                >
                                    {revealSecret ? <EyeOffIcon/> : <EyeIcon/>}
                                </IconButton>
                            )}
                        </div>
                        {isSecret && !revealSecret ? (
                            <div className="flex flex-col items-center gap-1 rounded-(--radius-control) border border-dashed border-line bg-surface-sunken p-6 text-center text-ink-muted">
                                <LockIcon/>
                                <p>The content of this secret is hidden by default.</p>
                                <p>Use the Reveal secret button to show it.</p>
                            </div>
                        ) : (
                            <Textarea
                                aria-label="Key content"
                                readOnly
                                value={keyViewContent.content}
                                rows={16}
                                className="resize-y font-mono text-data"
                            />
                        )}
                    </div>
                )}
            </Dialog>

            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                title="Confirm Key Deletion"
                footer={
                    <>
                        <Button onClick={() => setDeleteDialogOpen(false)} disabled={actionLoading}>Cancel</Button>
                        <Button
                            variant="danger"
                            icon={<TrashIcon/>}
                            onClick={handleDeleteKey}
                            disabled={actionLoading}
                        >
                            Delete
                        </Button>
                    </>
                }
            >
                <p>
                    Are you sure you want to delete the key <strong className="font-mono">{keyToDelete}</strong>?
                </p>
            </Dialog>

            <KeyFormDialog
                open={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                onSubmit={handleCreateKey}
                mode="create"
                title="Create New Key"
                allowEmpty
                loading={actionLoading}
            />

            <KeyFormDialog
                open={updateDialogOpen}
                onClose={() => setUpdateDialogOpen(false)}
                onSubmit={handleUpdateKey}
                mode="update"
                initialName={updateInitialName}
                initialContent={updateInitialContent}
                initialInputMode={updateInitialInputMode}
                title="Update Key"
                loading={actionLoading}
                initialLoading={updateContentLoading}
            />
        </section>
    );
};

export default KeysSection;
