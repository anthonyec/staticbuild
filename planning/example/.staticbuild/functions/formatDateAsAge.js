module.exports = () => (text, render) => {
  const renderedDate = render(text);
  const date = new Date(renderedDate);

  return parseInt(date.getFullYear()) - 1992;
}
