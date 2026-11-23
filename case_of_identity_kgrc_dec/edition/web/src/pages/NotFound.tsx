import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="page">
      <div className="card pad" style={{ maxWidth: 640, margin: "40px auto", textAlign: "center" }}>
        <p className="kicker">Case not found</p>
        <h1>The trail goes cold</h1>
        <p style={{ fontFamily: "var(--f-type)" }}>“It is quite a three-pipe problem” — but this page does not exist.</p>
        <Link className="btn primary" to="/read">Back to the story →</Link>
      </div>
    </div>
  );
}
