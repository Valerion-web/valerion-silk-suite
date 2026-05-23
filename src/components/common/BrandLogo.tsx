import { Link } from "react-router-dom";

export default function BrandLogo() {
  return (
    <Link to="/" className="brand-logo group shrink-0">
      <img
        src="/logo/brand-logo.png"
        alt="House of Valerion"
        className="brand-icon"
      />
    </Link>
  );
}
