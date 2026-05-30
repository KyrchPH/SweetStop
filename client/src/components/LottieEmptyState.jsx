import LottieModule from "lottie-react";

import emptyAnimation from "../assets/empty.json";

const Lottie = LottieModule?.default ?? LottieModule;

function LottieEmptyState({
  title = "Nothing here yet",
  message = "New items will appear here once they are available."
}) {
  return (
    <div className="lottie-empty-state">
      <div className="lottie-empty-art" aria-hidden="true">
        <Lottie
          animationData={emptyAnimation}
          autoplay
          className="lottie-empty-animation"
          loop
          rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
        />
      </div>
      <div className="lottie-empty-copy">
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
    </div>
  );
}

export default LottieEmptyState;
