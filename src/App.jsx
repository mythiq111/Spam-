import { useEffect, useRef, useState } from "react";
import { paragraphs, memoriesTitle, memoriesMessage, photoCaptions, photoTags } from "./letter.js";

// Drop photos into src/photos/ and they show up here automatically (sorted by file name).
const PHOTOS = Object.entries(
  import.meta.glob("./photos/*.{jpg,jpeg,png,webp,gif,avif,JPG,JPEG,PNG}", {
    eager: true,
    query: "?url",
    import: "default",
  })
)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([path, src]) => {
    const name = path.split("/").pop();
    return { src, caption: photoCaptions[name] || "", tag: photoTags[name] || "" };
  });
import {
  startMusic,
  setMuted,
  playPaper,
  playTap,
  playYes,
  playGentle,
} from "./sounds.js";

const DEFAULTS = { friendName: "Friend", myName: "Me", whatsapp: "" };

const REPLIES = {
  yes: {
    text: "Thank you. Chitti. I promise From Now Onwards  I'll become a best friend you deserve.paina rasina letter chadhivavu kadha adi calrity naku aa bussiness start cheyadaniki money ella techukovaloo dani kosam a differnt ways chustunna nuvu clarity ledhu anukuntunnav dani ae trying to figure out different ways (Nenu rasinadey 😏) ❤",
    wa: "I read your letter. Yes, let's be best friends again. ❤",
  },
  time: {
    text: "Ok Kani please Kopam loney anna nijm ga really sorry ",
    wa: "I read your letter. I need a little time, but thank you for writing it.",
  },
};

const NO_STEPS = [
  "Okkasari alochinchu... 🥺",
  "Promise ga, inosari annanu 🥹",
  "Pakka promise, kopam lo em annanu. Isari last chance 🙏",
  "Sorry Kadha... 💔",
  "Enuku antha kopamuu sorry kadhaa.. 🥺",
  "Sare time theesko... but nee ishtam ",
];

export default function App() {
  const [config, setConfig] = useState(DEFAULTS);
  const [stage, setStage] = useState("intro"); // intro | letter | memories
  const [zoomed, setZoomed] = useState(null); // photo url shown in the lightbox
  const [gateOpen, setGateOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passError, setPassError] = useState("");
  const [checking, setChecking] = useState(false);
  const passRef = useRef(null);
  const [showAsk, setShowAsk] = useState(false);
  const [answer, setAnswer] = useState(null); // null | "yes" | "time"
  const [muted, setMutedState] = useState(false);
  const [noCount, setNoCount] = useState(0);
  const [videoMuted, setVideoMuted] = useState(true); // muted autoplay is the only kind browsers allow
  const askRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : DEFAULTS))
      .then((c) => setConfig({ ...DEFAULTS, ...c }))
      .catch(() => { });
  }, []);

  useEffect(() => {
    document.title = `I'm sorry, ${config.friendName}`;
  }, [config.friendName]);

  useEffect(() => {
    if (stage !== "letter") return;
    // Reveal the question once the letter has finished fading in. Never scroll the page for them.
    const letterMs = (0.3 + (paragraphs.length + 1) * 0.35 + 0.9) * 1000;
    const t = setTimeout(() => setShowAsk(true), letterMs);
    return () => clearTimeout(t);
  }, [stage]);

  function open() {
    startMusic();
    playPaper();
    setStage("letter");
    window.scrollTo(0, 0);
  }

  function goTo(next) {
    playTap();
    setStage(next);
    window.scrollTo(0, 0);
  }

  function openGate() {
    playTap();
    setPassword("");
    setPassError("");
    setGateOpen(true);
  }

  function closeGate() {
    setGateOpen(false);
  }

  async function submitPassword(e) {
    e.preventDefault();
    if (checking || !password) return;
    setChecking(true);
    try {
      const r = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = r.ok ? await r.json() : null;
      if (data?.ok) {
        setUnlocked(true);
        setGateOpen(false);
        goTo("memories");
      } else if (r.status === 429) {
        setPassError("Too many tries. Wait a minute and try again.");
      } else if (data) {
        playGentle();
        setPassError("That's not it. Try again \u{1F642}");
      } else {
        setPassError("Couldn't check right now. Try again in a moment.");
      }
    } catch {
      setPassError("Couldn't check right now. Try again in a moment.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!gateOpen) return;
    passRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && setGateOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gateOpen]);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e) => e.key === "Escape" && setZoomed(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed]);

  function toggleVideoSound() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setVideoMuted(v.muted);
    if (!v.muted) v.play().catch(() => { });
  }

  function toggleMute() {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  }

  function reply(choice) {
    if (answer) return;
    setAnswer(choice);
    choice === "yes" ? playYes() : playGentle();
    fetch("/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: choice }),
    }).catch(() => { });
  }

  const waLink =
    answer && config.whatsapp
      ? `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(REPLIES[answer].wa)}`
      : null;

  return (
    <main>
      {stage !== "intro" && (
        <button
          className="mute"
          onClick={toggleMute}
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
          title={muted ? "Sound off" : "Sound on"}
        >
          {muted ? "\u{1F507}" : "\u{1F50A}"}
        </button>
      )}

      {stage === "intro" && (
        <section className="screen intro">
          <div className="intro-text">
            <p className="hand small">hey, {config.friendName}</p>
            <h1 className="hand">I wrote you something.</h1>
            <p className="soft">
              It's not long, and you don't have to reply. I just hope you'll read it.<br />
              You are very special to me.<br />
              Kopam lo chala annesaa eeoksari last chance ichi odileyohu ga please
              <br />
              <span className="tip">(Turn your volume up a little, there's soft music.)</span>
            </p>
            <button className="btn" onClick={open}>
              Open the letter
            </button>
          </div>

          <div className="video-wrap">
            <video
              ref={videoRef}
              className="sorry-video"
              src="/sorry.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
            />
            <button
              className="video-sound"
              onClick={toggleVideoSound}
              aria-label={videoMuted ? "Play video sound" : "Mute video"}
            >
              {videoMuted ? "\u{1F507} Tap for sound" : "\u{1F50A}"}
            </button>
          </div>
        </section>
      )}

      {stage === "letter" && (
        <section className="screen">
          <article className="letter">
            <p className="hand greeting">Dear best friend,</p>
            {paragraphs.map((p, i) => (
              <p key={i} className="line" style={{ animationDelay: `${0.3 + i * 0.35}s` }}>
                {p}
              </p>
            ))}
            <p
              className="hand sign line"
              style={{ animationDelay: `${0.3 + paragraphs.length * 0.35}s` }}
            >
              Always yours,
              <br />
              {config.myName}
            </p>
          </article>

          {showAsk && (
            <div className="ask" ref={askRef}>
              <h2 className="hand">So&hellip; can we be best friends again?</h2>

              {!answer && (
                <div className="choices">
                  <button
                    className="btn"
                    onClick={() => {
                      playTap();
                      reply("yes");
                    }}
                  >
                    Yes, we can
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => {
                      if (noCount < NO_STEPS.length) {
                        playGentle();
                        setNoCount(noCount + 1);
                      } else {
                        reply("time");
                      }
                    }}
                  >
                    {noCount === 0 ? "I need some time" : "Still no"}
                  </button>
                </div>
              )}

              {!answer && noCount > 0 && (
                <p className="soft reply" role="status" key={noCount}>
                  {NO_STEPS[noCount - 1]}
                </p>
              )}

              {answer && (
                <p className="soft reply" role="status">
                  {REPLIES[answer].text}
                </p>
              )}

              {waLink && (
                <a className="btn ghost" href={waLink} target="_blank" rel="noopener noreferrer">
                  Let me know on WhatsApp
                </a>
              )}
            </div>
          )}

          {answer === "yes" && (
            <div className="memories-cta">
              <button
                className="btn ghost"
                onClick={() => (unlocked ? goTo("memories") : openGate())}
              >
                {"\u{1F4F8}"} One more thing, look at this
              </button>
            </div>
          )}
        </section>
      )}

      {stage === "memories" && (
        <section className="screen memories">
          <h2 className="hand">{memoriesTitle}</h2>
          <p className="soft">{memoriesMessage}</p>

          {PHOTOS.length > 0 ? (
            <ul className="gallery">
              {PHOTOS.map((photo, i) => (
                <li
                  key={photo.src}
                  className={photo.caption ? "" : "solo"}
                  style={{ "--tilt": `${((i % 5) - 2) * 0.7}deg` }}
                >
                  <button onClick={() => setZoomed(photo)} aria-label={`Open photo ${i + 1}`}>
                    <span className="frame">
                      <img src={photo.src} alt={photo.tag || photo.caption || `Our memory ${i + 1}`} loading="lazy" decoding="async" />
                      {photo.tag && <span className="tag hand">{photo.tag}</span>}
                    </span>
                  </button>
                  {photo.caption && <p className="caption hand">{photo.caption}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="soft">(Add photos to the src/photos folder and they will appear here.)</p>
          )}

          <button className="btn ghost back" onClick={() => goTo("letter")}>
            Back to the letter
          </button>
        </section>
      )}

      {gateOpen && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-labelledby="gate-title" onClick={closeGate}>
          <form className="gate" onClick={(e) => e.stopPropagation()} onSubmit={submitPassword}>
            <h2 id="gate-title" className="hand">Enter the password</h2>
            <p className="soft">Password emo ni DOB {"\u{1F512}"}</p>
            <input
              ref={passRef}
              className="gate-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="go"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPassError("");
              }}
              aria-label="Password"
              aria-invalid={!!passError}
            />
            <p className="gate-error" role="alert">{passError}</p>
            <div className="choices">
              <button type="submit" className="btn" disabled={checking || !password}>
                {checking ? "Checking..." : "Unlock"}
              </button>
              <button type="button" className="btn ghost" onClick={closeGate}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {zoomed && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setZoomed(null)}>
          <span className="frame lightbox-frame">
            <img src={zoomed.src} alt={zoomed.tag || zoomed.caption || "Our memory, enlarged"} />
            {zoomed.tag && <span className="tag hand">{zoomed.tag}</span>}
          </span>
          {zoomed.caption && <p className="lightbox-caption hand">{zoomed.caption}</p>}
          <button className="lightbox-close" aria-label="Close photo">
            &times;
          </button>
        </div>
      )}
    </main>
  );
}
