import React from "react"
import {useTranslation} from "react-i18next"
import Dialog from '@mui/material/Dialog'
//import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'

function NotAuthenticated() {
    const {t} = useTranslation()
    return (
        <Dialog
            open={true}
            aria-labelledby="dialog-title"
        >
            <DialogTitle id="dialog-title">
                {t("Authentication")}
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {t("You are not authenticated. Choose an authentication method.")}
                </DialogContentText>
            </DialogContent>
        </Dialog>
    )
}

export default NotAuthenticated
