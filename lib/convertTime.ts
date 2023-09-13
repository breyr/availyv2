const convertTo12HourFormat = (time24: string): string => {
  // Split the input time into hours and minutes
  const [hours, minutes] = time24.split(':').map(Number);

  // Check if the input is a valid time
  if (
    isNaN(hours) ||
    isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return 'Invalid time';
  }

  // Determine AM or PM
  const period = hours < 12 ? 'AM' : 'PM';

  // Convert hours to 12-hour format
  const hours12 = hours % 12 || 12; // Handle midnight (0:00) as 12:00 AM

  // Format the time in 12-hour format
  const time12 = `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;

  return time12;
};

export default convertTo12HourFormat;
