import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Reveal, SiteFooter, SiteNav } from "../components/Layout";

const RATES = [
  {
    title: "Off-peak",
    detail: "Mon–Fri before 5pm",
    price: "€28",
    unit: "per hour",
  },
  {
    title: "Peak",
    detail: "Evenings & weekends",
    price: "€38",
    unit: "per hour",
  },
  {
    title: "Members",
    detail: "Priority booking rates",
    price: "€24",
    unit: "per hour",
  },
];

const INFO = [
  {
    title: "Session length",
    body: "Book 60 or 90 minutes. Most social games run for an hour.",
  },
  {
    title: "Players",
    body: "Courts are for doubles — up to four players per booking.",
  },
  {
    title: "Gear",
    body: "Bring your own racket or rent one on site. Balls included.",
  },
  {
    title: "Cancel",
    body: "Free cancel up to 12 hours before. Late cancels may be charged.",
  },
];

export default function Booking() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    date: "",
    time: "",
    court: "Any court",
    duration: "60 minutes",
    notes: "",
  });

  const bookingUrl = useMemo(() => {
    if (typeof window === "undefined") return "/book";
    return `${window.location.origin}/book`;
  }, []);

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    const subject = encodeURIComponent(
      `Court booking request — ${form.date || "date TBC"}`
    );
    const body = encodeURIComponent(
      [
        `Name: ${form.name}`,
        `Email: ${form.email}`,
        `Date: ${form.date}`,
        `Time: ${form.time}`,
        `Court: ${form.court}`,
        `Duration: ${form.duration}`,
        "",
        form.notes || "No extra notes.",
      ].join("\n")
    );

    window.location.href = `mailto:josh.hyland@icloud.com?subject=${subject}&body=${body}`;
    setSubmitted(true);
  }

  return (
    <>
      <SiteNav variant="solid" />

      <main className="booking-page">
        <section className="section booking-hero">
          <div className="section-inner booking-hero-layout">
            <Reveal>
              <p className="section-label">Booking</p>
              <h1 className="section-title booking-title">Book a court</h1>
              <p className="section-copy">
                Pick your slot, send a request, and we&apos;ll confirm by email.
                Same simple flow as How to play — choose, confirm, show up.
              </p>
            </Reveal>

            <Reveal delay={0.1} className="booking-qr">
              <div className="booking-qr-code" aria-hidden="true">
                <QRCodeSVG
                  value={bookingUrl}
                  size={148}
                  bgColor="#fafcfb"
                  fgColor="#0d3b2e"
                  level="M"
                  marginSize={1}
                />
              </div>
              <div className="booking-qr-copy">
                <p className="booking-qr-label">Scan to book</p>
                <p>
                  Idea for posters, the front desk, or WhatsApp — scan opens
                  this booking page.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section booking-rates">
          <div className="section-inner">
            <Reveal>
              <p className="section-label">Rates</p>
              <h2 className="section-title">What it costs</h2>
            </Reveal>

            <div className="rate-grid">
              {RATES.map((rate, i) => (
                <Reveal key={rate.title} delay={0.05 * (i + 1)} className="rate-item">
                  <p className="rate-title">{rate.title}</p>
                  <p className="rate-detail">{rate.detail}</p>
                  <p className="rate-price">
                    {rate.price}
                    <span> {rate.unit}</span>
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section booking-info">
          <div className="section-inner">
            <Reveal>
              <p className="section-label">Before you play</p>
              <h2 className="section-title">Booking details</h2>
            </Reveal>

            <div className="info-grid">
              {INFO.map((item, i) => (
                <Reveal key={item.title} delay={0.05 * (i + 1)} className="info-item">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section booking-form-section" id="request">
          <div className="section-inner booking-form-layout">
            <Reveal>
              <p className="section-label">Request a slot</p>
              <h2 className="section-title">Send your booking</h2>
              <p className="section-copy">
                Fill this in and it opens an email to{" "}
                <a href="mailto:josh.hyland@icloud.com">josh.hyland@icloud.com</a>
                . We&apos;ll reply to confirm availability.
              </p>
              <p className="booking-hours">
                Open Mon–Fri 7am–11pm · Sat–Sun 8am–10pm
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              {submitted ? (
                <div className="booking-thanks">
                  <h3>Request ready</h3>
                  <p>
                    Your email app should open with the booking details. If it
                    didn&apos;t, email us directly at{" "}
                    <a href="mailto:josh.hyland@icloud.com">
                      josh.hyland@icloud.com
                    </a>
                    .
                  </p>
                  <Link className="btn btn-primary" to="/">
                    Back home
                  </Link>
                </div>
              ) : (
                <form className="booking-form" onSubmit={handleSubmit}>
                  <label>
                    Name
                    <input
                      required
                      type="text"
                      value={form.name}
                      onChange={update("name")}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Email
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={update("email")}
                      autoComplete="email"
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Preferred date
                      <input
                        required
                        type="date"
                        value={form.date}
                        onChange={update("date")}
                      />
                    </label>
                    <label>
                      Preferred time
                      <input
                        required
                        type="time"
                        value={form.time}
                        onChange={update("time")}
                      />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      Court
                      <select value={form.court} onChange={update("court")}>
                        <option>Any court</option>
                        <option>Court 1</option>
                        <option>Court 2</option>
                        <option>Court 3</option>
                      </select>
                    </label>
                    <label>
                      Duration
                      <select
                        value={form.duration}
                        onChange={update("duration")}
                      >
                        <option>60 minutes</option>
                        <option>90 minutes</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Notes
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={update("notes")}
                      placeholder="Players, coaching, or anything else we should know"
                    />
                  </label>
                  <button className="btn btn-primary" type="submit">
                    Request booking
                  </button>
                </form>
              )}
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
