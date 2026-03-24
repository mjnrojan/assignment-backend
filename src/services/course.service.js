const store = require('../data/store');
const { v4: uuidv4 } = require('uuid');

const getAllCourses = () => {
  return store.courses;
};

const getCourseById = (id) => {
  return store.courses.find(course => course.id === id);
};

const createCourse = (data) => {
  const newCourse = {
    id: uuidv4(),
    title: data.title,
    description: data.description,
    instructorId: data.instructorId,
    price: data.price,
    createdAt: new Date().toISOString()
  };
  store.courses.push(newCourse);
  return newCourse;
};

const updateCourse = (id, data) => {
  const index = store.courses.findIndex(course => course.id === id);
  if (index === -1) {
    return null;
  }
  
  const updatedCourse = {
    ...store.courses[index],
    title: data.title || store.courses[index].title,
    description: data.description || store.courses[index].description,
    instructorId: data.instructorId || store.courses[index].instructorId,
    price: data.price !== undefined ? data.price : store.courses[index].price
  };
  
  store.courses[index] = updatedCourse;
  return updatedCourse;
};

const deleteCourse = (id) => {
  const index = store.courses.findIndex(course => course.id === id);
  if (index === -1) {
    return false;
  }
  
  store.courses.splice(index, 1);
  return true;
};

module.exports = {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse
};
