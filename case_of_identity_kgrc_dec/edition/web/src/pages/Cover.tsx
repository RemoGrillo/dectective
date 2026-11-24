// The cover: the one full-yellow page, an original 1930s-giallo-style cover (black frame, author's byline, title,
// medallion). It says what the site is: the story as a test bench for DEC, not an edition for reading a mystery.
import { Link } from "react-router";
import { Medallion } from "../components/Glyphs";
import { useApp, withMode } from "../state";

export function Cover() {
  const { mode } = useApp();
  return (
    <div className="cover">
      <div className="cover-card">
        <div className="cover-frame">
          <div className="series">Dectective · DEC at work</div>
          <p className="byline">Arthur Conan Doyle's</p>
          <h1>A Case of<br />Identity</h1>
          <p className="cover-sub">The story as a test bench for a reasoner</p>
          <Medallion size={150} fill="#FFFFFF" />
          <div className="band">Doxastic · Epistemic · Conjectural</div>
          <p className="pitch">Every claim, belief and guess in Conan Doyle's text is encoded as a point of view. DEC, a reasoner over such worlds, works out what follows, which views clash with what is true, and where it cannot tell, and every answer shows the sentence and the query behind it.</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <Link className="btn primary" to={withMode("/read", mode)}>Read the text with DEC →</Link>
            <Link className="btn" to={withMode("/dossiers", mode)}>Five questions for DEC</Link>
          </div>
        </div>
        <nav className="entry" aria-label="Other ways in">
          <Link to={withMode("/perspectives", mode)}><strong>Perspectives</strong>Cognitive worlds and the kaleidoscope</Link>
          <Link to={withMode("/deductions", mode)}><strong>Deductions</strong>What DEC concludes, clue by clue</Link>
          <Link to={withMode("/dossiers", mode)}><strong>Case files</strong>What DEC adds, and where it fails</Link>
          <Link to={withMode("/method", mode)}><strong>How it works</strong>Model, audit, limits</Link>
        </nav>
      </div>
    </div>
  );
}
