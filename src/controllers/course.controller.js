const courseService = require('../services/course.service');

const getAllCourses = (req, res) => {
  const courses = courseService.getAllCourses();
  res.status(200).json(courses);
};

const getCourseById = (req, res) => {
  const course = courseService.getCourseById(req.params.id);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }
  res.status(200).json(course);
};

const createCourse = (req, res) => {
  const { title, description, instructorId, price } = req.body;
  
  // Basic validation
  if (!title || !description || !instructorId || price === undefined) {
    return res.status(400).json({ error: 'Title, description, instructorId, and price are required' });
  }

  const newCourse = courseService.createCourse({ title, description, instructorId, price });
  res.status(201).json(newCourse);
};

const updateCourse = (req, res) => {
  const { title, description, instructorId, price } = req.body;
  
  const updatedCourse = courseService.updateCourse(req.params.id, { title, description, instructorId, price });
  
  if (!updatedCourse) {
    return res.status(404).json({ error: 'Course not found' });
  }
  
  res.status(200).json(updatedCourse);
};

const deleteCourse = (req, res) => {
  const success = courseService.deleteCourse(req.params.id);
  
  if (!success) {
    return res.status(404).json({ error: 'Course not found' });
  }
  
  res.status(200).json({ message: 'Course deleted successfully' });
};

module.exports = {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse
};
