module.exports = () => (text, render) => {
  function formatDateWithTemplate(template, date) {
    var specs = 'YYYY:MM:DD:HH:mm:ss'.split(':');
    date = new Date(date || Date.now() - new Date().getTimezoneOffset() * 6e4);
    return date.toISOString().split(/[-:.TZ]/).reduce(function(template, item, i) {
      return template.split(specs[i]).join(item);
    }, template);
  }

  const renderedDate = render(text);
  const date = new Date(renderedDate);

  return formatDateWithTemplate('YYYY-MM-DD', date);
