import React, {useEffect, useState, useMemo, useRef} from "react";
import {useParams} from "react-router-dom";
import axios from "axios";
import debounce from "lodash.debounce";
import {URL_NETWORK_IP} from "../config/apiPath.js";
import logger from '../utils/logger.js';
import {Table, HeaderRow, HeaderCell, Row, Cell, EmptyRow} from "../ui/components/Table";
import {Alert} from "../ui/components/Alert";
import {Button} from "../ui/components/Button";
import {Input} from "../ui/components/Field";
import {Spinner} from "../ui/components/Spinner";
import {ChevronDownIcon} from "../ui/icons";

const NetworkDetails = () => {
    const [ipDetails, setIpDetails] = useState([]);
    const [networkType, setNetworkType] = useState("N/A");
    const [nodeFilter, setNodeFilter] = useState("");
    const [pathFilter, setPathFilter] = useState("");
    const [ridFilter, setRidFilter] = useState("");
    const [showFilters, setShowFilters] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const {networkName} = useParams();
    const containerRef = useRef(null);

    // Scroll to top on component mount and when networkName changes
    useEffect(() => {
        window.scrollTo(0, 0);
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }
    }, [networkName]);

    useEffect(() => {
        let isMounted = true;
        const fetchIpDetails = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem("authToken");
                const res = await axios.get(URL_NETWORK_IP, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                const filteredItems = (res.data.items || []).filter(
                    (item) => item.network?.name === networkName
                );
                if (isMounted) {
                    setIpDetails(filteredItems);
                    setNetworkType(
                        filteredItems.length > 0
                            ? filteredItems[0].network?.type || "N/A"
                            : "N/A"
                    );
                }
            } catch (err) {
                logger.error("Error retrieving network IP details", err);
                if (isMounted) {
                    setError("Failed to load network details. Please try again.");
                    setIpDetails([]);
                    setNetworkType("N/A");
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        if (networkName) {
            fetchIpDetails();
        } else {
            setNetworkType("N/A");
            setIpDetails([]);
            setIsLoading(false);
        }

        return () => {
            isMounted = false;
        };
    }, [networkName]);

    // Debounced filter handlers
    const debouncedSetNodeFilter = useMemo(
        () => debounce((value) => setNodeFilter(value), 300),
        []
    );
    const debouncedSetPathFilter = useMemo(
        () => debounce((value) => setPathFilter(value), 300),
        []
    );
    const debouncedSetRidFilter = useMemo(
        () => debounce((value) => setRidFilter(value), 300),
        []
    );

    // Clean up debounced functions on unmount
    useEffect(() => {
        return () => {
            debouncedSetNodeFilter.cancel();
            debouncedSetPathFilter.cancel();
            debouncedSetRidFilter.cancel();
        };
    }, [debouncedSetNodeFilter, debouncedSetPathFilter, debouncedSetRidFilter]);

    const filteredIpDetails = useMemo(() => {
        return ipDetails.filter(
            (detail) =>
                (nodeFilter === "" ||
                    (detail.node || "")
                        .toLowerCase()
                        .includes(nodeFilter.toLowerCase())) &&
                (pathFilter === "" ||
                    (detail.path || "")
                        .toLowerCase()
                        .includes(pathFilter.toLowerCase())) &&
                (ridFilter === "" ||
                    (detail.rid || "")
                        .toLowerCase()
                        .includes(ridFilter.toLowerCase()))
        );
    }, [ipDetails, nodeFilter, pathFilter, ridFilter]);

    return (
        <div ref={containerRef} className="p-4 space-y-3">
            <h1 className="text-title font-semibold">
                Network Details: {networkName || "N/A"} ({networkType})
            </h1>
            {error && <Alert>{error}</Alert>}
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    icon={<ChevronDownIcon className={showFilters ? "rotate-180" : undefined}/>}
                    aria-label={showFilters ? "Hide filters" : "Show filters"}
                    aria-expanded={showFilters}
                >
                    {showFilters ? "Hide filters" : "Show filters"}
                </Button>
                {showFilters && (
                    <>
                        <label className="flex items-center gap-1 text-ink-muted">
                            Node
                            <Input
                                className="h-7 w-48"
                                value={nodeFilter}
                                onChange={(e) => debouncedSetNodeFilter(e.target.value)}
                            />
                        </label>
                        <label className="flex items-center gap-1 text-ink-muted">
                            Path
                            <Input
                                className="h-7 w-48"
                                value={pathFilter}
                                onChange={(e) => debouncedSetPathFilter(e.target.value)}
                            />
                        </label>
                        <label className="flex items-center gap-1 text-ink-muted">
                            RID
                            <Input
                                className="h-7 w-48"
                                value={ridFilter}
                                onChange={(e) => debouncedSetRidFilter(e.target.value)}
                            />
                        </label>
                    </>
                )}
            </div>
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <Spinner label="Loading network details"/>
                </div>
            ) : (
                <Table sticky>
                    <caption className="sr-only">Network details</caption>
                    <thead>
                        <HeaderRow>
                            <HeaderCell>IP</HeaderCell>
                            <HeaderCell>Node</HeaderCell>
                            <HeaderCell>Path</HeaderCell>
                            <HeaderCell>RID</HeaderCell>
                        </HeaderRow>
                    </thead>
                    <tbody>
                        {filteredIpDetails.length > 0 ? (
                            filteredIpDetails.map((detail, index) => (
                                <Row key={`${detail.rid}-${index}`}>
                                    <Cell className="font-medium">{detail.ip || "N/A"}</Cell>
                                    <Cell>{detail.node || "N/A"}</Cell>
                                    <Cell>{detail.path || "N/A"}</Cell>
                                    <Cell>{detail.rid || "N/A"}</Cell>
                                </Row>
                            ))
                        ) : (
                            <EmptyRow colSpan={4}>No IP details available for this network.</EmptyRow>
                        )}
                    </tbody>
                </Table>
            )}
        </div>
    );
};

export default NetworkDetails;
