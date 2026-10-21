/** Full-page navigation, kept in one place so tests can observe it. */
export const browser = {
  assign(href: string) {
    window.location.assign(href);
  },
};
