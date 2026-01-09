class Plant {
  final String id;
  final String plantId;
  final String plantType;
  final String plantName;
  final int idealTemperatureMin;
  final int idealTemperatureMax;
  final int idealHumidityMin;
  final int idealHumidityMax;
  final int idealSoilMoistureMin;
  final int idealSoilMoistureMax;
  final int idealLightIntensityMin;
  final int idealLightIntensityMax;
  final String description;

  Plant({
    required this.id,
    required this.plantId,
    required this.plantType,
    required this.plantName,
    required this.idealTemperatureMin,
    required this.idealTemperatureMax,
    required this.idealHumidityMin,
    required this.idealHumidityMax,
    required this.idealSoilMoistureMin,
    required this.idealSoilMoistureMax,
    required this.idealLightIntensityMin,
    required this.idealLightIntensityMax,
    required this.description,
  });

  factory Plant.fromJson(Map<String, dynamic> json) {
    return Plant(
      id: json['_id'],
      plantId: json['PlantID'],
      plantType: json['PlantType'],
      plantName: json['PlantName'],
      idealTemperatureMin: json['ideal_temperature_min'],
      idealTemperatureMax: json['ideal_temperature_max'],
      idealHumidityMin: json['ideal_humidity_min'],
      idealHumidityMax: json['ideal_humidity_max'],
      idealSoilMoistureMin: json['ideal_soil_moisture_min'],
      idealSoilMoistureMax: json['ideal_soil_moisture_max'],
      idealLightIntensityMin: json['ideal_light_intensity_min'],
      idealLightIntensityMax: json['ideal_light_intensity_max'],
      description: json['description'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      "PlantID": plantId,
      "PlantType": plantType,
      "PlantName": plantName,
      "ideal_temperature_min": idealTemperatureMin,
      "ideal_temperature_max": idealTemperatureMax,
      "ideal_humidity_min": idealHumidityMin,
      "ideal_humidity_max": idealHumidityMax,
      "ideal_soil_moisture_min": idealSoilMoistureMin,
      "ideal_soil_moisture_max": idealSoilMoistureMax,
      "ideal_light_intensity_min": idealLightIntensityMin,
      "ideal_light_intensity_max": idealLightIntensityMax,
      "description": description,
    };
  }
}
