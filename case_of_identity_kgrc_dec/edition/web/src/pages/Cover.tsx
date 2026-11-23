// The cover: the one full-yellow page, an original 1930s-giallo-style cover (black frame, title, medallion).
import { Link } from "react-router";
import { Medallion } from "../components/Glyphs";
import { useApp, withMode } from "../state";

export function Cover() {
  const { mode } = useApp();
  return (
    <div className="cover">
      <div className="cover-card">
        <div className="cover-frame">
          <div className="series">Dectective · An augmented edition</div>
          <h1>A Case of<br />Identity</h1>
          <p className="author">Arthur Conan Doyle, 1891</p>
          <Medallion size={170} fill="#FFFFFF" />
          <div className="band">Who lies · who is deceived · who knows what</div>
          <p className="pitch">Read the story with a reasoner at your side. Every sentence shows what each character says, believes and supposes, checked against what is really true, and why.</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <Link className="btn primary" to={withMode("/read", mode)}>Start reading →</Link>
            <Link className="btn" to={withMode("/read?s=P067.S01", mode)}>Show me a deception</Link>
          </div>
        </div>
        <nav className="entry" aria-label="Other ways in">
          <Link to={withMode("/kaleidoscope", mode)}><strong>Kaleidoscope</strong>Who knows what</Link>
          <Link to={withMode("/dossiers", mode)}><strong>Case files</strong>Each verdict, explained</Link>
          <Link to={withMode("/cast", mode)}><strong>Cast</strong>One view per person</Link>
        </nav>
      </div>
    </div>
  );
}
