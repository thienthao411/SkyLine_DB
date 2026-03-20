const express = require("express");
const router = express.Router();
const airportController = require("../controllers/airportController");

router.get("/", airportController.getAirports);
router.get("/admin", airportController.getAirportsForAdmin);
router.post("/", airportController.createAirport);
router.put("/:id", airportController.updateAirport);

module.exports = router;
