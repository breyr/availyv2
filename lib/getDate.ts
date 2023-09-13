// Gets the current date that's in the same format for Slack's datepicker
export const getCurrentDate = () => {
  const d = new Date()
    .toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
    })
    .split('/');

  return `${d[2]}-${d[0]}-${d[1]}`;
};

export default getCurrentDate;
