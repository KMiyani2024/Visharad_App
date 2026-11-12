/**
 * Re-mounts on every navigation, so each page eases in (.page-enter in
 * globals.css). The header, sidebar and tab bar live in the layout and stay put.
 */
export default function Template({ children }: { children: React.ReactNode }) {
    return <div className="page-enter">{children}</div>;
}
