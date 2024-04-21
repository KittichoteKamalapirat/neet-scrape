export const repeatStringsByFrequency = (
  strings: string[],
  frequencies: number[],
): string[] => {
  // Initialize an empty array to hold the result
  let result: string[] = [];
  console.log('frequencies', frequencies);

  // Loop through the strings array
  strings.forEach((string, index) => {
    // Get the frequency for the current string
    const frequency = frequencies[index];

    // Repeat the string frequency times and push it to the result array
    for (let i = 0; i < frequency; i++) {
      result.push(string);
    }
  });

  // Return the populated result array
  return result;
};
