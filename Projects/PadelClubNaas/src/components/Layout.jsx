import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";

export function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <strong>Padel Club Naas</strong>
      <p>
        Coming soon ·{" "}
        <a href="mailto:josh.hyland@icloud.com">josh.hyland@icloud.com</a>
        {" · "}
        <a href="tel:+353838744737">083 874 4737</a>
      </p>
    </footer>
  );
}

export function SiteNav({ variant = "hero" }) {
  return (
    <header className={`nav ${variant === "solid" ? "nav-solid" : ""}`}>
      <Link className="nav-brand" to="/">
        Padel Club Naas
      </Link>
      <ul className="nav-links">
        <li>
          <Link to="/#courts">Courts</Link>
        </li>
        <li>
          <Link to="/#play">Play</Link>
        </li>
        <li>
          <Link to="/book">Book</Link>
        </li>
        <li>
          <Link to="/#invest">Invest</Link>
        </li>
        <li>
          <Link to="/#visit">Visit</Link>
        </li>
      </ul>
    </header>
  );
}
