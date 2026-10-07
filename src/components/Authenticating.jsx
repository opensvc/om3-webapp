import {useTranslation} from "react-i18next"
import {Button} from "../ui/components/Button"
import {Spinner} from "../ui/components/Spinner"

function Authenticating() {
    const {t} = useTranslation()
    return (
        <section
            aria-labelledby="dialog-title"
            className="mx-auto mt-[15vh] flex max-w-sm flex-col items-center gap-3 p-4 text-center"
        >
            <h1 id="dialog-title" className="text-title font-semibold">
                {t("Authentication")}
            </h1>
            <div className="flex items-center gap-2">
                <Spinner label={t("Loading...")}/>
                <p className="text-ink-muted">
                    {t("You are being redirected to the openid provider.")}
                </p>
            </div>
            <Button onClick={() => window.location.reload()}>
                {t("Reload")}
            </Button>
        </section>
    )
}

export default Authenticating
