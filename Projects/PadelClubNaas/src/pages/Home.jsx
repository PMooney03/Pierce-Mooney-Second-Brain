import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Reveal, SiteFooter, SiteNav } from "../components/Layout";

const HERO_IMAGE = "/images/hero-padel.jpg";

export default function Home() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = hash.replace("#", "");
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, [hash]);

  return (
    <>
      <SiteNav />

      <main id="top">
        <section className="hero" aria-label="Welcome">
          <div className="hero-media" aria-hidden="true">
            <img
              src={HERO_IMAGE}
              alt=""
              width={2000}
              height={1333}
              fetchPriority="high"
            />
            <div className="hero-scrim" />
          </div>

          <div className="hero-content">
            <motion.h1
              className="hero-brand"
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            >
              Padel Club
              <span>Naas</span>
            </motion.h1>

            <motion.p
              className="hero-lede"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.15,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              Fast rallies and three indoor courts — a local padel club for Naas, coming soon.
            </motion.p>

            <motion.div
              className="hero-actions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.75,
                delay: 0.28,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Link className="btn btn-primary" to="/book">
                Book a court
              </Link>
              <a className="btn btn-ghost" href="#visit">
                Find us
              </a>
            </motion.div>
          </div>
        </section>

        <section className="section courts" id="courts">
          <div className="section-inner">
            <Reveal>
              <p className="section-label">Coming soon</p>
              <h2 className="section-title">In the works for Naas</h2>
              <p className="section-copy">
                A local padel club is on the way — three indoor courts, built
                for the town. Not open yet, but it&apos;s happening.
              </p>
            </Reveal>

            <div className="court-grid">
              <Reveal delay={0.05} className="court-item">
                <h3>3 indoor courts</h3>
                <p>Planned so you can play year-round, rain or shine.</p>
              </Reveal>
              <Reveal delay={0.12} className="court-item">
                <h3>For Naas</h3>
                <p>A proper local club — not a big-city chain feel.</p>
              </Reveal>
              <Reveal delay={0.19} className="court-item">
                <h3>Stay tuned</h3>
                <p>Register interest and we&apos;ll shout when booking goes live.</p>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="section play" id="play">
          <div className="section-inner">
            <Reveal>
              <p className="section-label">How to play</p>
              <h2 className="section-title">On court in minutes</h2>
              <p className="section-copy">
                No complicated signup. Pick a time, grab a racket if you need
                one, and get playing.
              </p>
            </Reveal>

            <div className="play-steps">
              <Reveal delay={0.05} className="play-step">
                <h3>Choose a slot</h3>
                <p>Browse available times across all three courts.</p>
              </Reveal>
              <Reveal delay={0.12} className="play-step">
                <h3>Confirm &amp; pay</h3>
                <p>Secure your booking online — members get priority rates.</p>
              </Reveal>
              <Reveal delay={0.19} className="play-step">
                <h3>Show up &amp; play</h3>
                <p>Arrive 10 minutes early. Rackets and balls available on site.</p>
              </Reveal>
            </div>

            <Reveal delay={0.22} className="play-cta">
              <Link className="btn btn-primary" to="/book">
                Book a court
              </Link>
              <p className="play-cta-note">
                See prices, session lengths, and request your preferred time.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="section invest" id="invest">
          <div className="section-inner invest-layout">
            <Reveal>
              <p className="section-label">Invest</p>
              <h2 className="section-title">Interested in investing?</h2>
              <p className="section-copy">
                Padel Club Naas is in the works — three indoor courts for the
                town. If you&apos;d like to talk about getting involved as an
                investor or partner, get in touch.
              </p>
            </Reveal>

            <Reveal delay={0.1} className="invest-actions">
              <a
                className="btn btn-primary"
                href="mailto:josh.hyland@icloud.com?subject=Investment%20interest%20%E2%80%94%20Padel%20Club%20Naas"
              >
                Talk investment
              </a>
              <p className="invest-note">
                Email{" "}
                <a href="mailto:josh.hyland@icloud.com">josh.hyland@icloud.com</a>
                {" "}or call{" "}
                <a href="tel:+353838744737">083 874 4737</a>
                {" "}— early conversations welcome.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="section visit" id="visit">
          <div className="section-inner">
            <Reveal>
              <p className="section-label">Visit</p>
              <h2 className="section-title">Right here in Naas</h2>
              <p className="section-copy">
                Easy to find, easy to park. Drop in for a hit or join a weekly
                social.
              </p>
            </Reveal>

            <div className="visit-layout">
              <Reveal delay={0.08}>
                <dl className="visit-details">
                  <dt>Address</dt>
                  <dd>Naas, Co. Kildare</dd>
                  <dt>Hours</dt>
                  <dd>Mon–Fri 7am–11pm · Sat–Sun 8am–10pm</dd>
                  <dt>Contact</dt>
                  <dd>
                    <a href="mailto:josh.hyland@icloud.com">
                      josh.hyland@icloud.com
                    </a>
                  </dd>
                  <dt>Phone</dt>
                  <dd>
                    <a href="tel:+353838744737">083 874 4737</a>
                  </dd>
                </dl>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="visit-map" aria-hidden="true">
                  Naas · Kildare
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
