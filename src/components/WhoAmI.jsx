import React, {useEffect, useState} from 'react';
import {URL_AUTH_WHOAMI} from '../config/apiPath';
import {
    Card,
    CardContent,
    LinearProgress,
    Alert,
    Typography
} from '@mui/material';

const WhoAmI = () => {
    const [userInfo, setUserInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const response = await fetch(URL_AUTH_WHOAMI, {
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                });

                if (!response.ok) {
                    setError('Failed to load user information');
                    return;
                }
                setUserInfo(await response.json());
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchUserInfo();
    }, []);

    if (loading) return <LinearProgress/>;
    if (error) return <Alert severity="error">{error}</Alert>;

    const infoSections = [
        {
            title: "Identity",
            items: [
                {label: "Username", value: userInfo.name},
                {label: "Authentication Method", value: userInfo.auth}
            ]
        },
        {
            title: "Access",
            items: [
                {label: "Namespace", value: userInfo.namespace},
                {label: "Raw Permissions", value: userInfo.raw_grant || 'None'}
            ]
        }
    ];

    return (
        <div className="p-4 max-w-2xl mx-auto">
            <Card className="rounded-lg shadow-sm">
                <CardContent className="space-y-6">
                    <Typography variant="h5" component="h1" className="font-bold text-gray-800">
                        My Information
                    </Typography>

                    {infoSections.map((section, index) => (
                        <div key={index} className="space-y-3">
                            <Typography variant="subtitle1" className="font-medium text-gray-600">
                                {section.title}
                            </Typography>

                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                {section.items.map((item, i) => (
                                    <div key={i} className="flex">
                                        <div className="w-1/3">
                                            <Typography variant="body2" className="text-gray-500">
                                                {item.label}
                                            </Typography>
                                        </div>
                                        <div className="w-2/3">
                                            <Typography variant="body1" className="font-mono">
                                                {item.value}
                                            </Typography>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="space-y-3">
                        <Typography variant="subtitle1" className="font-medium text-gray-600">
                            Permission Details
                        </Typography>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <pre className="text-sm text-gray-800 overflow-x-auto">
                                {JSON.stringify(userInfo.grant, null, 2)}
                            </pre>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default WhoAmI;
