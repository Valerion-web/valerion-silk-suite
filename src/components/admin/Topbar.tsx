import React from "react";
import { useLocation } from "react-router-dom";
import SearchBox from "./SearchBox";
import Notifications from "./Notifications";
import ProfileMenu from "./ProfileMenu";

export default function Topbar() {
  const location = useLocation();
  const hideSearch = location.pathname.startsWith("/admin/products");

  return (
    <div className="flex h-full items-center justify-between px-6">
      {!hideSearch ? (
        <div className="w-full max-w-xl">
          <SearchBox />
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Notifications count={3} />
        <ProfileMenu showName />
      </div>
    </div>
  );
}
