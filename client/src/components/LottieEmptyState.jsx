import Lottie from "lottie-react";

import emptyAnimation from "../assets/empty.json";

function LottieEmptyState({
  title = "Nothing here yet",
  message = "New items will appear here once they are available."
}) {
  return (
    <div className="lottie-empty-state">
      <Lottie
        animationData={emptyAnimation}
        autoplay
        className="lottie-empty-animation"
        loop
      />
      <div className="lottie-empty-copy">
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
    </div>
  );
}

export default LottieEmptyState;
