// src/api/codeforcesAPI.js
import axios from 'axios';

export const getCodeForcesProblems = async () => {
  try {
    const response = await axios.get('https://codeforces.com/api/problemset.problems');
    // Return the array of problems
    return response.data.result.problems;
  } catch (error) {
    throw new Error('Error fetching CodeForces problems');
  }
};
