import { Link } from "react-router-dom";

function WelfareHeader({ pageName, children }) {
    return (
        <header style = {styles.topHeader}>
            <div style = {styles.brandArea}>
                <div style = {styles.logoBox}>우리</div>
                <strong style = {styles.serviceName}>우리</strong>
                <span style = {styles.headerPageName}>{pageName}</span>
            </div>
            {children}
        </header>
    );
}

const styles = {
    topHeader : {
        height : "64px",
        padding : "0 max(28px, calc((100% - 1280px) / 2 + 28px))",
        borderBottom : "1px solid var(--border-color)",
        backgroundColor : "white",
        display : "flex",
        alignItems : "center",
        justifyContent : "space-between",
        boxSizing : "border-box",
    },
    brandArea : {
        display : "flex",
        alignItems : "center",
        gap : "12px",
        minWidth : 0,
    },
    logoBox : {
        width : "34px",
        height : "34px",
        borderRadius : "7px",
        backgroundColor : "var(--main-color)",
        color : "white",
        display : "grid",
        placeItems : "center",
        fontSize : "15px",
        fontWeight : "800",
        lineHeight : "1",
        flexShrink : 0,
    },
    serviceName : {
        fontSize : "22px",
        fontWeight : "800",
        color : "var(--text-color)",
    },
    headerPageName : {
        paddingLeft : "16px",
        borderLeft : "1px solid var(--border-color)",
        color : "#4B5563",
        fontSize : "15px",
        whiteSpace : "nowrap",
    },
};

export default WelfareHeader;
