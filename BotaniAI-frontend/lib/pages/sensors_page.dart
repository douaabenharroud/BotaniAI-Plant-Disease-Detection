import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import '../models/plant.dart';

class PlantDetailPage extends StatefulWidget {
  final Plant plant;
  const PlantDetailPage({required this.plant, Key? key}) : super(key: key);

  @override
  _PlantDetailPageState createState() => _PlantDetailPageState();
}

class _PlantDetailPageState extends State<PlantDetailPage> {
  double temperature = 23.0;
  double humidity = 55.0;
  double co2 = 400.0;

  final Random _rand = Random();
  Timer? _timer;

  List<Map<String, dynamic>> extraSensors = [];

  @override
  void initState() {
    super.initState();

    _timer = Timer.periodic(const Duration(seconds: 4), (_) {
      setState(() {
        temperature = (20 + _rand.nextInt(10)).toDouble();
        humidity = (40 + _rand.nextInt(40)).toDouble();
        co2 = (380 + _rand.nextInt(50)).toDouble();
      });
    });

    extraSensors = [
      {
        "name": "Soil Moisture",
        "value": 70.0,
        "unit": "%",
        "description": "Measures how wet the soil is.",
        "color": Colors.brown,
        "active": true,
      },
      {
        "name": "Light Intensity",
        "value": 450.0,
        "unit": "Lux",
        "description": "Amount of sunlight received by the plant.",
        "color": Colors.yellow,
        "active": true,
      },
    ];
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String getRecommendation() {
    if (temperature > widget.plant.maxTemp) return "⚠️ Too hot! Move to a cooler spot.";
    if (temperature < widget.plant.minTemp) return "⚠️ Too cold! Add sunlight.";
    if (humidity < 40) return "💧 Humidity low. Consider misting.";
    if (co2 > 430) return "🌫 High CO₂! Ventilate the room.";
    return "✅ Plant is healthy!";
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          SliverAppBar(
            expandedHeight: 300,
            pinned: true,
            stretch: true,
            backgroundColor: const Color(0xFF2E5F2F),
            flexibleSpace: FlexibleSpaceBar(
              title: Text(widget.plant.name),
              background: Hero(
                tag: widget.plant.id,
                child: Image.network(
                  widget.plant.imageUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    color: Colors.grey.shade300,
                    child: const Center(
                      child: Icon(Icons.image_not_supported, size: 80, color: Colors.grey),
                    ),
                  ),
                ),
              ),
              stretchModes: const [StretchMode.zoomBackground, StretchMode.blurBackground],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.delete),
                onPressed: _showDeleteDialog,
              )
            ],
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _sectionCard(child: _buildPlantDescription()),
                  _sectionCard(child: _buildIdealConditions()),
                  _sectionCard(child: _buildLiveSensors()),
                  _sectionCard(
                    child: Column(
                      children: [
                        _buildExtraSensors(),
                        const SizedBox(height: 10),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2E5F2F),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    SensorsPage(extraSensors: extraSensors),
                              ),
                            ).then((updatedList) {
                              if (updatedList != null) {
                                setState(() => extraSensors = updatedList);
                              }
                            });
                          },
                          child: const Text("Manage Sensors", style: TextStyle(color: Colors.white)),
                        ),
                      ],
                    ),
                  ),
                  _sectionCard(child: _buildRecommendation()),
                  const SizedBox(height: 30),
                ],
              ),
            ),
          ),
        ],
      ),

      floatingActionButton: FloatingActionButton(
        backgroundColor: const Color(0xFF2E5F2F),
        child: const Icon(Icons.history),
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => RecommendationHistoryPage(widget.plant)),
          );
        },
      ),
    );
  }

  Widget _sectionCard({required Widget child}) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 10, offset: Offset(0, 5))],
      ),
      child: child,
    );
  }

  Widget _sectionTitle(String title) {
    return Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold));
  }

  Widget _buildPlantDescription() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle("🌱 About Plant"),
        const SizedBox(height: 8),
        Text(widget.plant.description, style: const TextStyle(fontSize: 16, height: 1.5)),
      ],
    );
  }

  Widget _buildIdealConditions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle("🌿 Ideal Conditions"),
        const SizedBox(height: 12),
        _infoRow("Temperature", "${widget.plant.minTemp}°C - ${widget.plant.maxTemp}°C"),
        _infoRow("Humidity", "${widget.plant.humidity}%"),
      ],
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text("$label:", style: const TextStyle(fontSize: 16)),
          const SizedBox(width: 8),
          Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildLiveSensors() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle("📡 Live Sensors"),
        const SizedBox(height: 12),
        _sensorBar("Temperature", temperature, "°C", Colors.orange, 50),
        _sensorBar("Humidity", humidity, "%", Colors.blue, 100),
        _sensorBar("CO₂", co2, "PPM", Colors.green, 500),
      ],
    );
  }

  Widget _sensorBar(String name, double value, String unit, Color color, double maxValue) {
    double normalized = (value / maxValue).clamp(0.0, 1.0);
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(Icons.circle, color: color, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontSize: 16)),
                const SizedBox(height: 4),
                Stack(
                  children: [
                    Container(
                      height: 6,
                      decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(3)),
                    ),
                    Container(
                      height: 6,
                      width: MediaQuery.of(context).size.width * 0.6 * normalized,
                      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text("${value.toStringAsFixed(1)} $unit", style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildExtraSensors() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle("🔬 Additional Sensors"),
        const SizedBox(height: 12),
        for (var sensor in extraSensors)
          Container(
            margin: const EdgeInsets.symmetric(vertical: 6),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Icon(Icons.sensor_window, color: sensor['color']),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(sensor['name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 2),
                      Text(sensor['description'], style: TextStyle(fontSize: 13, color: Colors.grey[700])),
                    ],
                  ),
                ),
                Text("${sensor['value']} ${sensor['unit']}", style: const TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildRecommendation() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle("🧠 Recommendation"),
        const SizedBox(height: 8),
        Text(
          "${getRecommendation()}\n🕒 ${DateTime.now().hour}:${DateTime.now().minute.toString().padLeft(2, '0')}",
          style: const TextStyle(fontSize: 16, height: 1.5),
        ),
      ],
    );
  }

  void _showDeleteDialog() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text("Delete Plant?"),
        content: const Text("Are you sure you want to delete this plant?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context, true);
            },
            child: const Text("Delete", style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}

class RecommendationHistoryPage extends StatelessWidget {
  final Plant plant;
  const RecommendationHistoryPage(this.plant, {Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Recommendation History"),
        backgroundColor: const Color(0xFF2E5F2F),
      ),
      body: const Center(
        child: Text("Recommendation history will appear here.", style: TextStyle(fontSize: 18)),
      ),
    );
  }
}

//////////////////////////////////////////////
//             SENSORS PAGE               //
//////////////////////////////////////////////

class SensorsPage extends StatefulWidget {
  final List<Map<String, dynamic>> extraSensors;

  const SensorsPage({super.key, required this.extraSensors});

  @override
  State<SensorsPage> createState() => _SensorsPageState();
}

class _SensorsPageState extends State<SensorsPage> {
  late List<Map<String, dynamic>> sensors;

  @override
  void initState() {
    super.initState();
    sensors = List.from(widget.extraSensors);
  }

  void _addSensor() {
    TextEditingController nameCtrl = TextEditingController();
    TextEditingController valueCtrl = TextEditingController();
    TextEditingController unitCtrl = TextEditingController();
    TextEditingController descCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text("Add Sensor"),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: "Name")),
            TextField(controller: valueCtrl, decoration: const InputDecoration(labelText: "Value"), keyboardType: TextInputType.number),
            TextField(controller: unitCtrl, decoration: const InputDecoration(labelText: "Unit")),
            TextField(controller: descCtrl, decoration: const InputDecoration(labelText: "Description")),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
          TextButton(
            onPressed: () {
              sensors.add({
                "name": nameCtrl.text,
                "value": double.tryParse(valueCtrl.text) ?? 0,
                "unit": unitCtrl.text,
                "description": descCtrl.text,
                "color": Colors.blue,
                "active": true,
              });
              setState(() {});
              Navigator.pop(context);
            },
            child: const Text("Add"),
          ),
        ],
      ),
    );
  }

  void _deleteSensor(int index) {
    sensors.removeAt(index);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Manage Sensors"),
        backgroundColor: const Color(0xFF2E5F2F),
      ),

      floatingActionButton: FloatingActionButton(
        backgroundColor: const Color(0xFF2E5F2F),
        child: const Icon(Icons.add),
        onPressed: _addSensor,
      ),

      body: ListView.builder(
        itemCount: sensors.length,
        itemBuilder: (_, i) {
          final s = sensors[i];

          return Card(
            margin: const EdgeInsets.all(12),
            child: ListTile(
              leading: Icon(Icons.sensors, color: s['color']),
              title: Text(s['name'], style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text("${s['value']} ${s['unit']}\n${s['description']}"),
              isThreeLine: true,
              trailing: Column(
                children: [
                  Switch(
                    value: s['active'],
                    onChanged: (v) {
                      setState(() => s['active'] = v);
                    },
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete, color: Colors.red),
                    onPressed: () => _deleteSensor(i),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    Navigator.pop(context, sensors);
    super.dispose();
  }
}
