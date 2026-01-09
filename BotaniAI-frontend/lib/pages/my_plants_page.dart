// lib/pages/my_plants_page.dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'plant_detail_page.dart';

class MyPlantsPage extends StatefulWidget {
  final String token;
  MyPlantsPage({required this.token});

  @override
  _MyPlantsPageState createState() => _MyPlantsPageState();
}

class _MyPlantsPageState extends State<MyPlantsPage> {
  final String plantsApi = 'http://localhost:5000/api/plants';
  final String assignmentsApi = 'http://localhost:5000/api/deviceassignments';
  List<PlantFromDb> _plants = [];
  bool _loading = true;
  bool _refreshing = false;

  // Plant type suggestions
  final List<String> _plantTypeSuggestions = [
    'Sansevieria cylindrica',
    'Dieffenbachia seguine',
    'Spathiphyllum wallisii',
    'Epipremnum aureum',
    'Peperomia obtusifolia',
    'Codiaeum variegatum',
    'Chlorophytum comosum',
    'Begonia maculata',
    'Dracaena trifasciata',
    'Calathea orbifolia',
    'Aglaonema commutatum',
    'Anthurium andraeanum',
    'Nephrolepis exaltata',
    'Philodendron hederaceum',
    'Monstera deliciosa',
    'Schefflera arboricola',
    'Zamioculcas zamiifolia',
    'Ficus lyrata',
    'Tradescantia zebrina',
  ];

  // Enhanced green color palette with dark green instead of maroon
  final Color primaryColor = const Color(0xFF006400); // Dark Green
  final Color primaryLight = const Color(0xFF008000); // Green
  final Color secondaryColor = const Color(0xFF32CD32); // Lime Green
  final Color accentColor = const Color(0xFF90EE90); // Light Green
  final Color backgroundColor = const Color(0xFFF0FFF0); // Honeydew
  final Color surfaceColor = Colors.white;
  final Color cardColor = const Color(0xFFF8FFF8);
  final Color textPrimary = const Color(0xFF003300); // Very Dark Green
  final Color textSecondary = const Color(0xFF006633); // Dark Spring Green
  final Color textLight = const Color(0xFF4CAF50); // Green
  final Color errorColor = const Color(0xFF006400);
  final Color warningColor = const Color(0xFF2E7D32); // Dark Green instead of orange
  final Color successColor = const Color(0xFF388E3C);
  final Color infoColor = const Color(0xFF1976D2);
  final Color darkGreenColor = const Color(0xFF2E7D32); // Dark Green
  final Color darkerGreen = const Color(0xFF1B5E20); // Darker Green
  final Color lightGreen = const Color(0xFFC8E6C9); // Light Green

  // Gradient colors
  final LinearGradient primaryGradient = const LinearGradient(
    colors: [Color(0xFF006400), Color(0xFF008000)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  final LinearGradient cardGradient = const LinearGradient(
    colors: [Color(0xFFF8FFF8), Color(0xFFF0FFF0)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  final LinearGradient darkGreenGradient = const LinearGradient(
    colors: [Color(0xFF2E7D32), Color(0xFF388E3C)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  @override
  void initState() {
    super.initState();
    _fetchPlants();
  }

  Future<void> _fetchPlants() async {
    if (!_refreshing) {
      setState(() {
        _loading = true;
      });
    }
    
    try {
      final resp = await http.get(
        Uri.parse(plantsApi),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
      );

      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body);
        List<dynamic> list = [];
        if (body is List) {
          list = body;
        } else if (body['data'] != null) {
          list = body['data'];
        }

        setState(() {
          _plants = list.map((e) => PlantFromDb.fromJson(e)).toList();
        });
      } else {
        _showSnackBar('Failed to load plants', isError: true);
      }
    } catch (e) {
      _showSnackBar('Error: $e', isError: true);
    } finally {
      setState(() {
        _loading = false;
        _refreshing = false;
      });
    }
  }

  void _showSnackBar(String message, {bool isError = false, bool isWarning = false}) {
    Color backgroundColor = isError ? errorColor : (isWarning ? darkGreenColor : successColor);
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              isError ? Icons.error_outline : 
              isWarning ? Icons.warning_amber : Icons.check_circle,
              color: Colors.white,
            ),
            const SizedBox(width: 8),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: backgroundColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      ),
    );
  }

  Future<void> _addPlantDialog() async {
    final formKey = GlobalKey<FormState>();
    final Map<String, dynamic> data = {
      "PlantName": "",
      "PlantType": "",
      "ideal_temperature_min": 0,
      "ideal_temperature_max": 0,
      "ideal_humidity_min": 0,
      "ideal_humidity_max": 0,
      "ideal_soil_moisture_min": 0,
      "ideal_soil_moisture_max": 0,
      "ideal_light_intensity_min": 0,
      "ideal_light_intensity_max": 0,
      "description": "",
      "SensorID": ""
    };

    // Track selected plant type and if we're showing suggestions
    String? selectedPlantType;
    bool showSuggestions = false;
    final TextEditingController plantTypeController = TextEditingController();

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return Dialog(
              backgroundColor: surfaceColor,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              elevation: 10,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  gradient: cardGradient,
                  border: Border.all(color: Colors.green.shade100, width: 1),
                ),
                padding: const EdgeInsets.all(24),
                child: SingleChildScrollView(
                  child: Form(
                    key: formKey,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Header with dark green gradient
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            gradient: darkGreenGradient,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: darkGreenColor.withOpacity(0.3),
                                blurRadius: 8,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.2),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white, width: 2),
                                ),
                                child: const Icon(Icons.local_florist, 
                                    color: Colors.white),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  'Add New Plant',
                                  style: TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.close, color: Colors.white),
                                onPressed: () => Navigator.pop(context),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                        
                        // Plant Info Section
                        _buildSectionHeader('Plant Information', icon: Icons.info),
                        const SizedBox(height: 16),
                        
                        _buildFormField(
                          label: 'Plant Name',
                          icon: Icons.spa,
                          onSaved: (v) => data['PlantName'] = v?.trim() ?? '',
                          validator: (v) => (v == null || v.trim().isEmpty) 
                              ? 'Required' : null,
                        ),
                        
                        // Plant Type field with dropdown
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              margin: const EdgeInsets.only(bottom: 16),
                              child: DropdownButtonFormField<String>(
                                decoration: InputDecoration(
                                  labelText: 'Plant Type',
                                  labelStyle: TextStyle(color: textSecondary),
                                  prefixIcon: Icon(Icons.category, color: primaryColor),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: BorderSide(color: Colors.green.shade200),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: BorderSide(color: Colors.green.shade300),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: BorderSide(color: primaryColor, width: 2),
                                  ),
                                  filled: true,
                                  fillColor: Colors.white,
                                  contentPadding: const EdgeInsets.all(16),
                                ),
                                value: selectedPlantType,
                                items: [
                                  DropdownMenuItem<String>(
                                    value: null,
                                    child: Text(
                                      'Select a plant type',
                                      style: TextStyle(color: Colors.grey.shade600),
                                    ),
                                  ),
                                  ..._plantTypeSuggestions.map((plantType) {
                                    return DropdownMenuItem<String>(
                                      value: plantType,
                                      child: Row(
                                        children: [
                                          Icon(Icons.eco, color: darkGreenColor, size: 18),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Text(
                                              plantType,
                                              style: TextStyle(
                                                color: textPrimary,
                                                fontSize: 14,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  }).toList(),
                                ],
                                onChanged: (value) {
                                  setState(() {
                                    selectedPlantType = value;
                                  });
                                  data['PlantType'] = value ?? '';
                                },
                                validator: (value) {
                                  if (value == null || value.isEmpty) {
                                    return 'Please select a plant type';
                                  }
                                  return null;
                                },
                                isExpanded: true,
                                icon: Icon(Icons.arrow_drop_down, color: darkGreenColor),
                                dropdownColor: Colors.white,
                                style: TextStyle(color: textPrimary),
                              ),
                            ),
                            
                            // Quick selection chips
                            Container(
                              margin: const EdgeInsets.only(bottom: 16),
                              child: Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: _plantTypeSuggestions
                                    .take(5)
                                    .map((plant) => ChoiceChip(
                                      label: Text(
                                        plant.split(' ').first,
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: selectedPlantType == plant 
                                              ? Colors.white 
                                              : textPrimary,
                                        ),
                                      ),
                                      selected: selectedPlantType == plant,
                                      onSelected: (selected) {
                                        setState(() {
                                          selectedPlantType = selected ? plant : null;
                                          data['PlantType'] = selectedPlantType ?? '';
                                        });
                                      },
                                      backgroundColor: Colors.white,
                                      selectedColor: darkGreenColor,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(20),
                                        side: BorderSide(
                                          color: selectedPlantType == plant 
                                              ? darkGreenColor 
                                              : Colors.green.shade300,
                                        ),
                                      ),
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 12, vertical: 6),
                                    ))
                                    .toList(),
                              ),
                            ),
                          ],
                        ),
                        
                        const SizedBox(height: 24),
                        
                        // Ideal Conditions Section
                        _buildSectionHeader('Ideal Conditions', icon: Icons.tune),
                        const SizedBox(height: 16),
                        
                        // Temperature Row
                        _buildConditionRow(
                          icon: Icons.thermostat,
                          label: 'Temperature',
                          minLabel: 'Min (°C)',
                          maxLabel: 'Max (°C)',
                          onMinSaved: (v) => data['ideal_temperature_min'] = 
                              int.tryParse(v ?? '') ?? 0,
                          onMaxSaved: (v) => data['ideal_temperature_max'] = 
                              int.tryParse(v ?? '') ?? 0,
                        ),
                        
                        const SizedBox(height: 12),
                        
                        // Humidity Row
                        _buildConditionRow(
                          icon: Icons.water_drop,
                          label: 'Humidity',
                          minLabel: 'Min (%)',
                          maxLabel: 'Max (%)',
                          onMinSaved: (v) => data['ideal_humidity_min'] = 
                              int.tryParse(v ?? '') ?? 0,
                          onMaxSaved: (v) => data['ideal_humidity_max'] = 
                              int.tryParse(v ?? '') ?? 0,
                        ),
                        
                        const SizedBox(height: 12),
                        
                        // Soil Moisture Row
                        _buildConditionRow(
                          icon: Icons.grass,
                          label: 'Soil Moisture',
                          minLabel: 'Min',
                          maxLabel: 'Max',
                          onMinSaved: (v) => data['ideal_soil_moisture_min'] = 
                              int.tryParse(v ?? '') ?? 0,
                          onMaxSaved: (v) => data['ideal_soil_moisture_max'] = 
                              int.tryParse(v ?? '') ?? 0,
                        ),
                        
                        const SizedBox(height: 12),
                        
                        // Light Intensity Row
                        _buildConditionRow(
                          icon: Icons.lightbulb,
                          label: 'Light Intensity',
                          minLabel: 'Min',
                          maxLabel: 'Max',
                          onMinSaved: (v) => data['ideal_light_intensity_min'] = 
                              int.tryParse(v ?? '') ?? 0,
                          onMaxSaved: (v) => data['ideal_light_intensity_max'] = 
                              int.tryParse(v ?? '') ?? 0,
                        ),
                        
                        const SizedBox(height: 24),
                        
                        // Additional Information Section
                        _buildSectionHeader('Additional Information', icon: Icons.description),
                        const SizedBox(height: 16),
                        
                        _buildFormField(
                          label: 'Description',
                          icon: Icons.description,
                          maxLines: 3,
                          onSaved: (v) => data['description'] = v?.trim() ?? '',
                        ),
                        
                      
                        
                        const SizedBox(height: 32),
                        
                        // Action Buttons
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton(
                                onPressed: () => Navigator.pop(context),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.transparent,
                                  foregroundColor: darkGreenColor,
                                  elevation: 0,
                                  padding: const EdgeInsets.symmetric(vertical: 16),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    side: BorderSide(color: darkGreenColor, width: 2),
                                  ),
                                ),
                                child: Text(
                                  'Cancel',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: darkGreenColor,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: ElevatedButton(
                                onPressed: () async {
                                  if (formKey.currentState!.validate()) {
                                    formKey.currentState!.save();
                                    // Ensure plant type is set
                                    if (selectedPlantType != null) {
                                      data['PlantType'] = selectedPlantType!;
                                    }
                                    Navigator.pop(context);
                                    await _createPlant(data);
                                  }
                                },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: darkGreenColor,
                                  foregroundColor: Colors.white,
                                  elevation: 4,
                                  padding: const EdgeInsets.symmetric(vertical: 16),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  shadowColor: darkGreenColor.withOpacity(0.5),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(Icons.add_circle_outline, size: 20),
                                    const SizedBox(width: 8),
                                    Text(
                                      'Create Plant',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 16,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildSectionHeader(String title, {IconData? icon}) {
    return Row(
      children: [
        if (icon != null) ...[
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: darkGreenColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: darkGreenColor, size: 18),
          ),
          const SizedBox(width: 12),
        ],
        Text(
          title,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: darkGreenColor,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }

  Widget _buildConditionRow({
    required IconData icon,
    required String label,
    required String minLabel,
    required String maxLabel,
    required FormFieldSetter<String> onMinSaved,
    required FormFieldSetter<String> onMaxSaved,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: darkGreenColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: darkGreenColor, size: 16),
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w500,
                color: darkGreenColor,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _buildNumberField(
                label: minLabel,
                onSaved: onMinSaved,
                isDarkGreen: true,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildNumberField(
                label: maxLabel,
                onSaved: onMaxSaved,
                isDarkGreen: true,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildFormField({
    required String label,
    required IconData icon,
    required FormFieldSetter<String> onSaved,
    FormFieldValidator<String>? validator,
    int maxLines = 1,
    bool isDarkGreen = false,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        decoration: InputDecoration(
          labelText: label,
          labelStyle: TextStyle(color: isDarkGreen ? darkGreenColor : textSecondary),
          prefixIcon: Icon(icon, color: isDarkGreen ? darkGreenColor : primaryColor),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: isDarkGreen ? lightGreen : Colors.green.shade200),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: isDarkGreen ? lightGreen : Colors.green.shade300),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: isDarkGreen ? darkGreenColor : primaryColor, width: 2),
          ),
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.all(16),
        ),
        onSaved: onSaved,
        validator: validator,
        maxLines: maxLines,
      ),
    );
  }

  Widget _buildNumberField({
    required String label,
    required FormFieldSetter<String> onSaved,
    bool isDarkGreen = false,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        decoration: InputDecoration(
          labelText: label,
          labelStyle: TextStyle(color: isDarkGreen ? darkGreenColor : textSecondary),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: isDarkGreen ? lightGreen : Colors.green.shade200),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: isDarkGreen ? lightGreen : Colors.green.shade300),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: isDarkGreen ? darkGreenColor : primaryColor, width: 2),
          ),
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.all(16),
        ),
        keyboardType: TextInputType.number,
        onSaved: onSaved,
      ),
    );
  }

  Future<void> _createPlant(Map<String, dynamic> payload) async {
    try {
      final resp = await http.post(
        Uri.parse(plantsApi),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: jsonEncode(payload),
      );

      if (resp.statusCode == 201) {
        final body = jsonDecode(resp.body)['data'];
        final plantId = body['_id'];
        final sensorID = payload['SensorID'];

        if (sensorID.isNotEmpty) {
          final assignResp = await http.post(
            Uri.parse(assignmentsApi),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${widget.token}',
            },
            body: jsonEncode({
              'plantID': plantId,
              'SensorID': sensorID,
            }),
          );

          if (assignResp.statusCode == 201) {
            _showSnackBar('Plant and sensor assignment created successfully');
          } else {
            final message = jsonDecode(assignResp.body)['message'] 
                ?? 'Sensor assignment failed';
            _showSnackBar(message, isError: true);
          }
        } else {
          _showSnackBar('Plant created successfully');
        }

        await _fetchPlants();
      } else {
        final message = jsonDecode(resp.body)['message'] 
            ?? 'Plant creation failed';
        _showSnackBar(message, isError: true);
      }
    } catch (e) {
      _showSnackBar('Error: $e', isError: true);
    }
  }

  Widget _buildPlantCard(PlantFromDb p) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Material(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(20),
        elevation: 3,
        shadowColor: primaryColor.withOpacity(0.15),
        child: InkWell(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => PlantDetailPage(plant: p, token: widget.token),
              ),
            );
          },
          onLongPress: () => _showPlantOptions(p),
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.green.shade100),
              gradient: cardGradient,
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    // Plant Avatar
                    Container(
                      width: 70,
                      height: 70,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF90EE90), Color(0xFF32CD32)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: primaryColor.withOpacity(0.2),
                            blurRadius: 8,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: const Icon(Icons.local_florist, 
                          color: Colors.white, size: 36),
                    ),
                    const SizedBox(width: 16),
                    
                    // Plant Info
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  p.PlantName,
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    color: textPrimary,
                                    letterSpacing: 0.5,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                  maxLines: 1,
                                ),
                              ),
                              // DELETE ICON BUTTON - ADDED HERE
                              IconButton(
                                icon: Icon(Icons.delete, color: errorColor, size: 22),
                                onPressed: () => _showDeleteConfirmation(p),
                                tooltip: 'Delete Plant',
                                padding: EdgeInsets.zero,
                                constraints: BoxConstraints(),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            p.PlantType,
                            style: TextStyle(
                              color: textLight,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                          const SizedBox(height: 8),
                          if (p.description.isNotEmpty) ...[
                            Text(
                              p.description.length > 80 
                                  ? '${p.description.substring(0, 80)}...' 
                                  : p.description,
                              style: TextStyle(
                                color: Colors.grey.shade600,
                                fontSize: 12,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 12),
                          ],
                        ],
                      ),
                    ),
                    
                    // Navigation Arrow with dark green color
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: darkGreenColor.withOpacity(0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.chevron_right, color: darkGreenColor, size: 20),
                    ),
                  ],
                ),
                
                // Conditions Summary
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.green.shade100),
                    gradient: LinearGradient(
                      colors: [Colors.white, const Color(0xFFF8FFF8)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildConditionIndicator(
                        icon: Icons.thermostat,
                        value: '${p.ideal_temperature_min}°-${p.ideal_temperature_max}°C',
                        label: 'Temp',
                      ),
                      _buildConditionIndicator(
                        icon: Icons.water_drop,
                        value: '${p.ideal_humidity_min}%-${p.ideal_humidity_max}%',
                        label: 'Humidity',
                      ),
                      _buildConditionIndicator(
                        icon: Icons.grass,
                        value: '${p.ideal_soil_moisture_min}-${p.ideal_soil_moisture_max}',
                        label: 'Soil',
                      ),
                      _buildConditionIndicator(
                        icon: Icons.lightbulb,
                        value: '${p.ideal_light_intensity_min}-${p.ideal_light_intensity_max}',
                        label: 'Light',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildConditionIndicator({
    required IconData icon,
    required String value,
    required String label,
  }) {
    return Column(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: darkGreenColor.withOpacity(0.05),
            shape: BoxShape.circle,
            border: Border.all(color: darkGreenColor.withOpacity(0.2)),
          ),
          child: Icon(icon, color: darkGreenColor, size: 18),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: textPrimary,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 9,
            color: darkGreenColor,
          ),
        ),
      ],
    );
  }

  void _showPlantOptions(PlantFromDb plant) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: surfaceColor,
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: cardGradient,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 60,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                plant.PlantName,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: textPrimary,
                ),
              ),
              Text(
                plant.PlantType,
                style: TextStyle(
                  color: darkGreenColor,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 24),
              _buildOptionButton(
                icon: Icons.edit,
                label: 'Edit Plant',
                color: darkGreenColor,
                onTap: () {
                  Navigator.pop(context);
                  // TODO: Implement edit functionality
                  _showSnackBar('Edit functionality coming soon!', isWarning: true);
                },
              ),
              _buildOptionButton(
                icon: Icons.delete,
                label: 'Delete Plant',
                color: errorColor,
                onTap: () {
                  Navigator.pop(context);
                  _showDeleteConfirmation(plant);
                },
              ),
              _buildOptionButton(
                icon: Icons.share,
                label: 'Share Plant',
                color: infoColor,
                onTap: () {
                  Navigator.pop(context);
                  _showSnackBar('Share functionality coming soon!', isWarning: true);
                },
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  foregroundColor: darkGreenColor,
                  elevation: 0,
                  minimumSize: const Size(double.infinity, 50),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(color: darkGreenColor, width: 2),
                  ),
                ),
                child: const Text('Close'),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildOptionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: color.withOpacity(0.1),
          foregroundColor: color,
          elevation: 0,
          minimumSize: const Size(double.infinity, 50),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: 20),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20),
            const SizedBox(width: 12),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w500,
                fontSize: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showDeleteConfirmation(PlantFromDb plant) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: surfaceColor,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: errorColor.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.warning, color: errorColor),
              ),
              const SizedBox(width: 12),
              Text(
                'Delete Plant',
                style: TextStyle(
                  color: errorColor,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          content: Text(
            'Are you sure you want to delete "${plant.PlantName}"? This action cannot be undone.',
            style: TextStyle(color: textPrimary),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'Cancel',
                style: TextStyle(color: darkGreenColor),
              ),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                _deletePlant(plant);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: errorColor,
                foregroundColor: Colors.white,
              ),
              child: const Text('Delete'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _deletePlant(PlantFromDb plant) async {
    try {
      // Call the backend DELETE API
      final resp = await http.delete(
        Uri.parse('$plantsApi/${plant.id}'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
      );

      if (resp.statusCode == 200) {
        // Remove plant from local list
        setState(() {
          _plants.removeWhere((p) => p.id == plant.id);
        });
        
        _showSnackBar('Plant "${plant.PlantName}" deleted successfully');
      } else {
        final body = jsonDecode(resp.body);
        final message = body['message'] ?? 'Failed to delete plant';
        _showSnackBar('Error: $message', isError: true);
      }
    } catch (e) {
      _showSnackBar('Error deleting plant: $e', isError: true);
    }
  }

  Widget _buildStatsHeader() {
    final totalPlants = _plants.length;
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: primaryGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: primaryColor.withOpacity(0.3),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildStatItem(
            value: totalPlants.toString(),
            label: 'Total Plants',
            icon: Icons.local_florist,
          ),
          
          Container(
            width: 1,
            height: 40,
            color: Colors.white.withOpacity(0.3),
          ),
         
        ],
      ),
    );
  }

  Widget _buildStatItem({
    required String value,
    required String label,
    required IconData icon,
  }) {
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: Colors.white, size: 16),
            ),
            const SizedBox(width: 8),
            Text(
              value,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.white.withOpacity(0.9),
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 180,
                height: 180,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF90EE90), Color(0xFF32CD32)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: primaryColor.withOpacity(0.2),
                      blurRadius: 20,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: const Icon(Icons.local_florist, 
                    size: 80, color: Colors.white),
              ),
              const SizedBox(height: 32),
              Text(
                'Your Garden Awaits',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: textPrimary,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Start your plant journey by adding your first plant\nand watch your garden grow',
                style: TextStyle(
                  fontSize: 16,
                  color: textSecondary,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.green.shade100),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.green.shade100,
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    _buildFeatureItem(
                      icon: Icons.monitor_heart,
                      title: 'Monitor Conditions',
                      description: 'Track plant conditions in real-time',
                      color: darkGreenColor,
                    ),
                    const SizedBox(height: 16),
                    _buildFeatureItem(
                      icon: Icons.notifications_active,
                      title: 'Smart Alerts',
                      description: 'Get notified about plant needs',
                      color: darkGreenColor,
                    ),
                    const SizedBox(height: 16),
                    _buildFeatureItem(
                      icon: Icons.insights,
                      title: 'Growth Insights',
                      description: 'Analyze plant progress over time',
                      color: darkGreenColor,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              ElevatedButton.icon(
                onPressed: _addPlantDialog,
                style: ElevatedButton.styleFrom(
                  backgroundColor: darkGreenColor,
                  foregroundColor: Colors.white,
                  elevation: 8,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 40, vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  shadowColor: darkGreenColor.withOpacity(0.5),
                ),
                icon: const Icon(Icons.add_circle, size: 24),
                label: const Text(
                  'Add Your First Plant',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFeatureItem({
    required IconData icon,
    required String title,
    required String description,
    required Color color,
  }) {
    return Row(
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [color.withOpacity(0.1), color.withOpacity(0.05)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withOpacity(0.2)),
          ),
          child: Icon(icon, color: color, size: 24),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: color,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                description,
                style: TextStyle(
                  color: textSecondary,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLoadingState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              gradient: primaryGradient,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: primaryColor.withOpacity(0.3),
                  blurRadius: 10,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: const Padding(
              padding: EdgeInsets.all(20),
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                strokeWidth: 3,
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Growing Your Garden...',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Loading your plants',
            style: TextStyle(
              fontSize: 14,
              color: darkGreenColor,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor,
      appBar: AppBar(
        title: Text(
          'My Plants',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 24,
            color: Colors.white,
            letterSpacing: 1,
          ),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: primaryGradient,
            boxShadow: [
              BoxShadow(
                color: primaryColor.withOpacity(0.3),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
        ),
        centerTitle: true,
        actions: [
         
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: () => _showSortOptions(),
            tooltip: 'Sort',
          ),
        ],
      ),
      body: _loading
          ? _buildLoadingState()
          : _plants.isEmpty
              ? _buildEmptyState()
              : Column(
                  children: [
                    _buildStatsHeader(),
                    Expanded(
                      child: RefreshIndicator(
                        onRefresh: _fetchPlants,
                        backgroundColor: surfaceColor,
                        color: darkGreenColor,
                        displacement: 40,
                        strokeWidth: 3,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          itemCount: _plants.length,
                          itemBuilder: (context, i) => _buildPlantCard(_plants[i]),
                        ),
                      ),
                    ),
                  ],
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addPlantDialog,
        backgroundColor: darkGreenColor,
        foregroundColor: Colors.white,
        elevation: 8,
        icon: const Icon(Icons.add, size: 24),
        label: const Text('Add Plant', style: TextStyle(fontWeight: FontWeight.bold)),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }

  void _showFilterOptions() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: cardGradient,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 60,
                height: 4,
                decoration: BoxDecoration(
                  color: darkGreenColor.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Filter Plants',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: darkGreenColor,
                ),
              ),
              const SizedBox(height: 24),
              // TODO: Implement filter options
              Text(
                'Filter options coming soon!',
                style: TextStyle(color: textSecondary),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: darkGreenColor,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 50),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Close'),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showSortOptions() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: cardGradient,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 60,
                height: 4,
                decoration: BoxDecoration(
                  color: darkGreenColor.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Sort Plants',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: darkGreenColor,
                ),
              ),
              const SizedBox(height: 24),
              // TODO: Implement sort options
              Text(
                'Sort options coming soon!',
                style: TextStyle(color: textSecondary),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: darkGreenColor,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 50),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Close'),
              ),
            ],
          ),
        );
      },
    );
  }
}

class PlantFromDb {
  final String id;
  final String plantID;
  final String PlantType;
  final String PlantName;
  final int ideal_temperature_min;
  final int ideal_temperature_max;
  final int ideal_humidity_min;
  final int ideal_humidity_max;
  final int ideal_soil_moisture_min;
  final int ideal_soil_moisture_max;
  final int ideal_light_intensity_min;
  final int ideal_light_intensity_max;
  final String description;

  PlantFromDb({
    required this.id,
    required this.plantID,
    required this.PlantType,
    required this.PlantName,
    required this.ideal_temperature_min,
    required this.ideal_temperature_max,
    required this.ideal_humidity_min,
    required this.ideal_humidity_max,
    required this.ideal_soil_moisture_min,
    required this.ideal_soil_moisture_max,
    required this.ideal_light_intensity_min,
    required this.ideal_light_intensity_max,
    required this.description,
  });

  factory PlantFromDb.fromJson(Map<String, dynamic> json) {
    return PlantFromDb(
      id: json['_id'] ?? '',
      plantID: json['PlantID'] ?? json['_id'] ?? '',
      PlantType: json['PlantType'] ?? '',
      PlantName: json['PlantName'] ?? '',
      ideal_temperature_min: (json['ideal_temperature_min'] ?? 0).round(),
      ideal_temperature_max: (json['ideal_temperature_max'] ?? 0).round(),
      ideal_humidity_min: (json['ideal_humidity_min'] ?? 0).round(),
      ideal_humidity_max: (json['ideal_humidity_max'] ?? 0).round(),
      ideal_soil_moisture_min: (json['ideal_soil_moisture_min'] ?? 0).round(),
      ideal_soil_moisture_max: (json['ideal_soil_moisture_max'] ?? 0).round(),
      ideal_light_intensity_min: (json['ideal_light_intensity_min'] ?? 0).round(),
      ideal_light_intensity_max: (json['ideal_light_intensity_max'] ?? 0).round(),
      description: json['description'] ?? '',
    );
  }
}