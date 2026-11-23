
function ArtifactToolbar() {
    return (
        <div className="artifact-toolbar">
            <div className="artifact-toolbar-left">
                <span className="artifact-home">⌂</span>
                <span className="artifact-name">Nexus ERP</span>
                <span className="artifact-dropdown">⌄</span>
                <span className="artifact-notice">
                    Content is user-generated and unverified.
                </span>
            </div>

            <div className="artifact-toolbar-right">
                <span className="artifact-avatar">PP</span>
                <button type="button" className="artifact-share">
                    ↥ Share
                </button>
            </div>
        </div>
    );
}

export default ArtifactToolbar;
