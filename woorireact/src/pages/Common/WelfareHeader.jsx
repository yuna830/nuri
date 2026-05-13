function WelfareHeader({ children }) {
    return (
        <header style = {styles.topHeader}>
            <div style = {styles.brandArea}>
                <strong style = {styles.serviceName}>우리 woori</strong>
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
        minWidth : 0,
    },
    serviceName : {
        fontSize : "20px",
        fontWeight : "700",
        color : "#86a788",
        whiteSpace : "nowrap",
    },
};

export default WelfareHeader;
