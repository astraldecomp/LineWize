/**
 * Checks if the page the script is injected into has the
 * custom stylesheet for Classwize messages injected or not
 * by checking a global flag variable.
 *
 * @return {boolean} If the flag is undefined, or false, the flag is set and returns true.
 */
(function () {
  if (window.hasLoadedLinewizeMessageCSS === true) {
    return false;
  } else {
    window.hasLoadedLinewizeMessageCSS = true;
    return true;
  }
})();
