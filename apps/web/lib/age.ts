export function ageGroupOf(age: number): "0-5" | "6-17" | "18-59" | "60+" {
  
  if (age <= 5) return "0-5";
  if (age <= 17) return "6-17";
  if (age <= 59) return "18-59";
  return "60+";
}