import { Link } from "react-router-dom";
import heroImg from "@/assets/hero.jpg";

export function CinematicHero() {
  return (
    <section className="hero-section">
      <img
        src={heroImg}
        alt="House of Valerion luxury fashion campaign"
        className="hero-image"
      />

      <div className="hero-overlay" />

      <div className="hero-actions">
        <Link to="/shop" className="hero-button hero-button-primary">
          EXPLORE COLLECTION
        </Link>
        <Link to="/shop" className="hero-button hero-button-secondary">
          NEW ARRIVALS
        </Link>
      </div>
    </section>
  );
}

export default CinematicHero;
