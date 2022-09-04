const fadeInSide = function (divElement) {
  setTimeout(() => {
    divElement.style.marginLeft = "0";
    divElement.style.backgroundColor = "rgba(74,74,74,0.95)";
  }, 500);
};

const fadeOutSide = function (divElement) {
  divElement.addEventListener(
    "transitionend",
    () => {
      divElement.remove();
    },
    false
  );
  divElement.style.marginLeft = "100%";
  divElement.style.opacity = "0";
};
