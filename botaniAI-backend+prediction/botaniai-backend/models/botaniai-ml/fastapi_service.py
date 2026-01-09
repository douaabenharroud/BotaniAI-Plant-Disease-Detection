from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
import pickle
import pandas as pd
import numpy as np
import os
import traceback
import uvicorn
from datetime import datetime
from typing import Optional

# Initialize FastAPI app
app = FastAPI(
    title="BotaniAI ML Prediction Service",
    version="2.0.0",
    description="Plant health prediction using machine learning",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ====== CORS CONFIGURATION ======
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

print("=" * 60)
print(" BotaniAI ML Prediction Service - Starting...")
print("=" * 60)

# Global variables
model = None
scaler = None
feature_names = []

# ====== PYDANTIC MODELS (FIXED) ======
class PredictionRequest(BaseModel):
    """Request model with proper aliases for % signs"""
    Height_cm: Optional[float] = Field(default=30.0, ge=1, le=300, description="Plant height in cm")
    Leaf_Count: Optional[float] = Field(default=12.0, ge=1, le=200, description="Number of leaves")
    New_Growth_Count: Optional[float] = Field(default=2.0, ge=0, le=50, description="New growth count")
    Watering_Amount_ml: Optional[float] = Field(default=250.0, ge=0, le=2000, description="Water amount in ml")
    Watering_Frequency_days: Optional[float] = Field(default=3.0, ge=0.5, le=30, description="Days between watering")
    Room_Temperature_C: Optional[float] = Field(default=24.0, ge=10, le=40, description="Temperature in Celsius")
    
    # 🔧 FIX: Use valid Python names with aliases for API
    Humidity_percent: Optional[float] = Field(
        default=55.0, 
        ge=0, 
        le=100, 
        description="Humidity percentage",
        alias="Humidity_%"  # ← API expects Humidity_%
    )
    
    Soil_Moisture_percent: Optional[float] = Field(
        default=50.0, 
        ge=0, 
        le=100, 
        description="Soil moisture percentage",
        alias="Soil_Moisture_%"  # ← API expects Soil_Moisture_%
    )
    
    model_config = ConfigDict(
        populate_by_name=True,  # Allows using alias names
        str_strip_whitespace=True,
        extra='ignore'
    )

# ====== HELPER FUNCTIONS ======
def inspect_pkl_files():
    """Inspect what's in the .pkl files"""
    print("\n" + "=" * 60)
    print("🔍 INSPECTING .PKL FILES")
    print("=" * 60)
    
    pkl_files = [f for f in os.listdir(".") if f.endswith(".pkl")]
    
    for file in pkl_files:
        try:
            print(f"\n📁 File: {file}")
            with open(file, "rb") as f:
                content = pickle.load(f)
            
            print(f"   Type: {type(content)}")
            
            if isinstance(content, dict):
                print(f"   📋 Dictionary with {len(content)} keys:")
                for key in content.keys():
                    print(f"      - '{key}': {type(content[key]).__name__}")
                    
                    # Vérifier si c'est un model
                    if hasattr(content[key], 'predict'):
                        print(f"        ✅ Has 'predict' method!")
                    if hasattr(content[key], 'fit'):
                        print(f"        ✅ Has 'fit' method!")
            
            elif hasattr(content, 'predict'):
                print(f"   🤖 Direct sklearn model: {content.__class__.__name__}")
            
            elif hasattr(content, 'transform'):
                print(f"   🔧 Scaler/Transformer: {content.__class__.__name__}")
            
            else:
                print(f"   ❓ Unknown content type")
                
        except Exception as e:
            print(f"   ❌ Error reading {file}: {e}")

def load_model_files():
    """Load model and scaler"""
    global model, scaler, feature_names
    
    try:
        print("\n" + "=" * 60)
        print(" 🔍 LOADING MODEL AND SCALER...")
        print("=" * 60)
        
        # Afficher le répertoire courant
        current_dir = os.getcwd()
        print(f"📂 Current directory: {current_dir}")
        
        # Inspecter d'abord les fichiers
        inspect_pkl_files()
        
        # Try to load scaler from scaler.pkl
        scaler_file = "scaler.pkl"
        if os.path.exists(scaler_file):
            try:
                with open(scaler_file, "rb") as f:
                    scaler_content = pickle.load(f)
                
                # Vérifier si c'est un dictionnaire ou un scaler direct
                if isinstance(scaler_content, dict):
                    print(f"\n📦 {scaler_file} contains a DICTIONARY")
                    print(f"   Keys: {list(scaler_content.keys())}")
                    
                    # Chercher le scaler dans différentes clés
                    scaler_keys = ['scaler', 'standard_scaler', 'minmax_scaler', 'transformer']
                    for key in scaler_keys:
                        if key in scaler_content:
                            scaler = scaler_content[key]
                            print(f"✅ Found scaler in key: '{key}'")
                            print(f"   Scaler type: {type(scaler).__name__}")
                            break
                    
                    if scaler is None:
                        # Chercher n'importe quel objet avec transform
                        for key, value in scaler_content.items():
                            if hasattr(value, 'transform'):
                                scaler = value
                                print(f"✅ Found scaler-like in key: '{key}'")
                                print(f"   Type: {type(scaler).__name__}")
                                break
                else:
                    scaler = scaler_content
                    print(f"\n✅ DIRECT SCALER LOADED from {scaler_file}")
                    print(f"   Scaler type: {type(scaler).__name__}")
                
            except Exception as e:
                print(f"❌ Error loading {scaler_file}: {e}")
                scaler = None
        else:
            print(f"\n❌ {scaler_file} NOT FOUND")
            scaler = None
        
        # Try to load model from model.pkl
        model_file = "model.pkl"
        if os.path.exists(model_file):
            try:
                with open(model_file, "rb") as f:
                    model_content = pickle.load(f)
                
                print(f"\n📦 {model_file} loaded successfully")
                print(f"   Content type: {type(model_content)}")
                
                # Si c'est un dictionnaire
                if isinstance(model_content, dict):
                    print("   📋 Dictionary content detected")
                    
                    # Chercher le model dans différentes clés
                    model_keys = ['model', 'classifier', 'clf', 'estimator', 'random_forest', 
                                 'rf_model', 'randomforest', 'classifier_model']
                    
                    for key in model_keys:
                        if key in model_content:
                            potential_model = model_content[key]
                            if hasattr(potential_model, 'predict'):
                                model = potential_model
                                print(f"✅ Found sklearn model in key: '{key}'")
                                print(f"   Model type: {type(model).__name__}")
                                break
                    
                    # Si pas trouvé par clés spécifiques, chercher n'importe quel objet avec predict
                    if model is None:
                        for key, value in model_content.items():
                            if hasattr(value, 'predict'):
                                model = value
                                print(f"✅ Found model in key: '{key}'")
                                print(f"   Model type: {type(model).__name__}")
                                break
                    
                    # Si on a trouvé un model, vérifier aussi si le scaler est dans le même fichier
                    if scaler is None:
                        scaler_keys = ['scaler', 'standard_scaler']
                        for key in scaler_keys:
                            if key in model_content:
                                scaler = model_content[key]
                                print(f"✅ Also found scaler in model.pkl key: '{key}'")
                                print(f"   Scaler type: {type(scaler).__name__}")
                                break
                
                # Si c'est directement un model sklearn
                elif hasattr(model_content, 'predict'):
                    model = model_content
                    print(f"\n✅ DIRECT SKLEARN MODEL LOADED")
                    print(f"   Model type: {type(model).__name__}")
                
                else:
                    print(f"❌ {model_file} doesn't contain a valid sklearn model")
                    model = None
                    
            except Exception as e:
                print(f"❌ Error loading {model_file}: {e}")
                model = None
        else:
            print(f"\n❌ {model_file} NOT FOUND")
            model = None
        
        # Vérifier si on a chargé avec succès
        if model is None:
            print("\n❌ FAILED TO LOAD A VALID MODEL")
            return False
        
        if scaler is None:
            print("\n⚠️ No scaler loaded, will skip scaling step")
        
        # Get feature names
        print("\n📋 GETTING FEATURE NAMES...")
        if hasattr(model, 'feature_names_in_'):
            feature_names = list(model.feature_names_in_)
            print(f"✅ Model has feature_names_in_: {feature_names}")
        elif hasattr(model, 'feature_importances_') and hasattr(model, 'n_features_in_'):
            # Créer des noms de features génériques
            feature_names = [f"feature_{i}" for i in range(model.n_features_in_)]
            print(f"⚠️ Model doesn't have feature names, using generic: {feature_names}")
        else:
            # Utiliser les features attendues par l'API
            feature_names = [
                "Height_cm", "Leaf_Count", "New_Growth_Count",
                "Watering_Amount_ml", "Watering_Frequency_days",
                "Room_Temperature_C", "Humidity_%", "Soil_Moisture_%"
            ]
            print(f"⚠️ Using default feature names: {feature_names}")
        
        print(f"   Total features: {len(feature_names)}")
        
        # Tester le model
        print("\n🧪 TESTING MODEL WITH SAMPLE DATA...")
        try:
            # Créer des données de test
            test_data = np.array([[30.0, 12.0, 2.0, 250.0, 3.0, 24.0, 55.0, 50.0]])
            
            # Créer un DataFrame
            test_df = pd.DataFrame(test_data, columns=feature_names[:8])
            
            # Scale si disponible
            if scaler is not None:
                try:
                    test_scaled = scaler.transform(test_df)
                    print("   ✅ Data scaled successfully")
                    X_test = test_scaled
                except Exception as e:
                    print(f"   ⚠️ Scaling failed: {e}")
                    X_test = test_df.values
            else:
                X_test = test_df.values
                print("   ⏭️ No scaler, using raw data")
            
            # Prédiction
            prediction = model.predict(X_test)
            pred_class = int(prediction[0])
            print(f"   ✅ Prediction successful: Class {pred_class}")
            
            # Probabilités si disponible
            if hasattr(model, 'predict_proba'):
                proba = model.predict_proba(X_test)
                confidence = proba[0][pred_class]
                print(f"   📊 Confidence: {confidence:.3f}")
            else:
                print("   ⚠️ Model doesn't have predict_proba method")
            
            print("   🎉 Model test PASSED!")
            
        except Exception as e:
            print(f"   ❌ Model test FAILED: {e}")
            traceback.print_exc()
            return False
        
        print("\n" + "=" * 60)
        print("✅ YOUR MODEL IS LOADED AND READY!")
        print("=" * 60)
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error in load_model_files: {e}")
        traceback.print_exc()
        return False

def create_fallback_model():
    """Create fallback model"""
    global model, scaler, feature_names
    
    print("\n" + "=" * 60)
    print("⚠️ CREATING FALLBACK MODEL...")
    print("=" * 60)
    print("⚠️ WARNING: This is NOT your trained model!")
    print("⚠️ This is a RANDOM model for testing only!")
    
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.preprocessing import StandardScaler
    
    # Feature names (with % signs for API)
    feature_names = [
        "Height_cm", "Leaf_Count", "New_Growth_Count",
        "Watering_Amount_ml", "Watering_Frequency_days",
        "Room_Temperature_C", "Humidity_%", "Soil_Moisture_%"
    ]
    
    # Training data
    np.random.seed(42)
    X = np.random.rand(100, len(feature_names)) * 100
    y = np.random.randint(0, 6, 100)
    
    # Scale
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Train
    model = RandomForestClassifier(n_estimators=50, random_state=42)
    model.fit(X_scaled, y)
    
    # Add feature names to model
    model.feature_names_in_ = np.array(feature_names)
    
    print("✅ Fallback model created")
    print("⚠️ REMEMBER: This is RANDOM DATA, not your real model!")
    print("=" * 60)
    
    return True

# Load or create model
if not load_model_files():
    print("\n" + "=" * 60)
    print("⚠️ FALLING BACK TO RANDOM MODEL")
    print("=" * 60)
    create_fallback_model()
else:
    print("\n" + "=" * 60)
    print("🎉 SUCCESS: Your real model is loaded!")
    print("=" * 60)

def get_prediction_description(pred_class: int) -> str:
    """Get human-readable description"""
    descriptions = {
        0: "🔵 UNKNOWN - Class 0 from model",
        1: "🚨 CRITICAL - Immediate attention needed!",
        2: "🔴 POOR - Plant health declining.",
        3: "🟠 FAIR - Plant is struggling.",
        4: "🟡 AVERAGE - Minor adjustments needed.",
        5: "🟢 GOOD - Plant is healthy.",
    }
    return descriptions.get(pred_class, f"Unknown class {pred_class}")

def prepare_features(input_dict: dict) -> pd.DataFrame:
    """Prepare features for model"""
    # Ensure all features exist
    defaults = {
        "Height_cm": 30.0,
        "Leaf_Count": 12.0,
        "New_Growth_Count": 2.0,
        "Watering_Amount_ml": 250.0,
        "Watering_Frequency_days": 3.0,
        "Room_Temperature_C": 24.0,
        "Humidity_%": 55.0,
        "Soil_Moisture_%": 50.0
    }
    
    # Update with input
    features = {**defaults, **input_dict}
    
    # Ensure correct feature order
    ordered_features = {}
    for feature in feature_names:
        ordered_features[feature] = features.get(feature, defaults.get(feature, 0.0))
    
    # Créer le DataFrame avec les noms de colonnes
    df = pd.DataFrame([ordered_features])
    
    # Assigner explicitement les noms de colonnes
    df.columns = feature_names
    
    return df

# ====== ROUTES ======
@app.get("/")
async def root():
    # Vérifier si on utilise le fallback
    model_type = type(model).__name__ if model else None
    using_fallback = "RandomForestClassifier" in str(model_type)
    
    return {
        "service": "BotaniAI ML Service",
        "status": "running",
        "model_loaded": model is not None,
        "model_type": model_type,
        "using_fallback": using_fallback,
        "features": feature_names,
        "features_count": len(feature_names),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health():
    # Vérifier si on utilise le fallback model
    model_type = type(model).__name__ if model else None
    using_fallback = "RandomForestClassifier" in str(model_type)
    
    return {
        "status": "healthy",
        "model": model_type,
        "using_fallback": using_fallback,
        "features_count": len(feature_names),
        "timestamp": datetime.now().isoformat()
    }

@app.post("/predict")
async def predict(request: PredictionRequest):
    """Main prediction endpoint - FIXED CONFIDENCE CALCULATION"""
    try:
        print("\n" + "=" * 60)
        print("🤖 PREDICTION REQUEST RECEIVED")
        print("=" * 60)
        
        # Vérifier quel model est utilisé
        model_type = type(model).__name__ if model else None
        if "RandomForestClassifier" in str(model_type):
            print("⚠️ WARNING: USING FALLBACK MODEL - Not your trained model!")
            print("⚠️ This prediction is based on RANDOM DATA!")
            using_fallback = True
        else:
            print(f"✅ USING YOUR REAL MODEL: {model_type}")
            using_fallback = False
        
        # Convert with aliases
        input_data = request.model_dump(by_alias=True)
        print(f"📥 Input data:")
        for key, value in input_data.items():
            print(f"   {key}: {value}")
        
        # Prepare features
        df = prepare_features(input_data)
        print(f"📊 Features prepared: {df.shape}")
        print(f"   Features: {list(df.columns)}")
        
        # Scale if available
        if scaler:
            try:
                X = scaler.transform(df)
                print("🔧 Data scaled successfully")
            except Exception as e:
                print(f"⚠️ Scaling error: {e}")
                X = df.values
        else:
            X = df.values
            print("⏭️ No scaler available, using raw data")
        
        # Predict
        prediction = model.predict(X)
        original_class = int(prediction[0])  # Keep original class for confidence calculation
        
        print(f"\n🎯 INITIAL PREDICTION: Class {original_class}")
        
        # Handle class 0 if exists (convert to your expected 1-5 range)
        final_class = original_class
        if original_class == 0:
            final_class = 1
            print("⚠️ Class 0 detected, converting to Class 1 for output")
        
        # CONFIDENCE CALCULATION - FIXED VERSION
        confidence = 0.0
        if hasattr(model, 'predict_proba'):
            try:
                # Get probabilities for all classes
                proba_array = model.predict_proba(X)
                print(f"📊 Probability array shape: {proba_array.shape}")
                
                # Get probabilities for this specific prediction
                proba = proba_array[0]
                print(f"📊 Raw probabilities: {proba}")
                
                # Check model's class labels if available
                if hasattr(model, 'classes_'):
                    print(f"📊 Model classes_: {model.classes_}")
                    print(f"📊 Original prediction class (from model): {original_class}")
                
                # Get confidence for the ORIGINAL predicted class
                # This ensures we're using the correct index
                if original_class < len(proba):
                    confidence = float(proba[original_class])
                    print(f"📊 Confidence from proba[{original_class}]: {confidence}")
                else:
                    # If original_class is out of bounds, use the maximum probability
                    confidence = float(np.max(proba))
                    print(f"📊 Using max probability: {confidence}")
                    
            except Exception as e:
                print(f"⚠️ Confidence calculation error: {e}")
                traceback.print_exc()
                confidence = 0.85  # Fallback
        else:
            confidence = 0.85
            print("⚠️ Model doesn't have predict_proba, using default confidence")
        
        # Ensure confidence is not zero
        if confidence == 0:
            confidence = 0.01  # Minimum small value
            print("⚠️ Confidence was 0, setting to minimum value 0.01")
        elif confidence < 0.01:
            confidence = 0.01
            print(f"⚠️ Confidence too low ({confidence}), setting to 0.01")
        
        print(f"\n🎯 FINAL PREDICTION RESULT:")
        print(f"   Original class from model: {original_class}")
        print(f"   Final class returned: {final_class}")
        print(f"   Confidence: {confidence:.3f}")
        print(f"   Recommendation: {get_prediction_description(final_class)}")
        print("=" * 60)
        
        # Response
        response = {
            "success": True,
            "prediction": final_class,
            "original_model_prediction": original_class,  # Add this for debugging
            "prediction_label": f"Class {final_class}",
            "recommendation": get_prediction_description(final_class),
            "confidence": round(confidence, 3),
            "timestamp": datetime.now().isoformat(),
            "model_type": model_type,
            "using_fallback": using_fallback,
            "features_used": input_data
        }
        
        return response
        
    except Exception as e:
        print(f"❌ Error in prediction: {e}")
        traceback.print_exc()
        raise HTTPException(500, detail={"error": str(e)})

@app.post("/predict/simple")
async def predict_simple(data: dict):
    """Simple endpoint that accepts any format"""
    try:
        print("\n" + "=" * 60)
        print("🤖 SIMPLE PREDICTION REQUEST")
        print("=" * 60)
        
        # Vérifier quel model est utilisé
        model_type = type(model).__name__ if model else None
        using_fallback = "RandomForestClassifier" in str(model_type)
        
        if using_fallback:
            print("⚠️ USING FALLBACK MODEL - Not your trained model!")
        else:
            print(f"✅ USING LOADED MODEL: {model_type}")
        
        # Handle both naming styles
        mapping = {
            "Humidity": "Humidity_%",
            "humidity": "Humidity_%",
            "Humidity_percent": "Humidity_%",
            "SoilMoisture": "Soil_Moisture_%",
            "soil_moisture": "Soil_Moisture_%",
            "SoilMoisture_percent": "Soil_Moisture_%"
        }
        
        # Normalize keys
        normalized = {}
        for key, value in data.items():
            if key in mapping:
                normalized[mapping[key]] = value
            elif key in feature_names:
                normalized[key] = value
            else:
                # Try exact match
                if key.replace(" ", "_") in feature_names:
                    normalized[key.replace(" ", "_")] = value
        
        print(f"📥 Input data: {data}")
        print(f"📊 Normalized data: {normalized}")
        
        # Use the main prediction logic
        df = prepare_features(normalized)
        
        if scaler:
            X = scaler.transform(df)
        else:
            X = df.values
        
        prediction = model.predict(X)
        original_class = int(prediction[0])
        final_class = original_class
        
        # Convert class 0 if needed
        if original_class == 0:
            final_class = 1
        
        # Confidence calculation
        confidence = 0.85
        if hasattr(model, 'predict_proba'):
            try:
                proba = model.predict_proba(X)[0]
                if original_class < len(proba):
                    confidence = float(proba[original_class])
                else:
                    confidence = float(np.max(proba))
            except Exception as e:
                print(f"⚠️ Confidence calculation error: {e}")
        
        # Ensure confidence is not zero
        if confidence == 0:
            confidence = 0.01
        
        print(f"\n🎯 PREDICTION RESULT:")
        print(f"   Original class: {original_class}")
        print(f"   Final class: Class {final_class}")
        print(f"   Confidence: {confidence:.3f}")
        print("=" * 60)
        
        return {
            "success": True,
            "prediction": final_class,
            "original_model_prediction": original_class,
            "prediction_label": f"Class {final_class}",
            "confidence": round(confidence, 3),
            "original_data": data,
            "normalized_data": normalized,
            "timestamp": datetime.now().isoformat(),
            "model_type": model_type,
            "using_fallback": using_fallback
        }
        
    except Exception as e:
        print(f"❌ Error in simple prediction: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/test")
async def test():
    """Test endpoint"""
    test_data = {
        "Height_cm": 35.5,
        "Leaf_Count": 18.0,
        "New_Growth_Count": 3.0,
        "Watering_Amount_ml": 300.0,
        "Watering_Frequency_days": 2.5,
        "Room_Temperature_C": 24.5,
        "Humidity_%": 60.0,  # Note: Using alias
        "Soil_Moisture_%": 55.0  # Note: Using alias
    }
    
    return {
        "message": "Test endpoint",
        "sample_request": test_data,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/features")
async def get_features():
    """Get expected features"""
    return {
        "features": feature_names,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/model-info")
async def model_info():
    """Get model information"""
    model_type = type(model).__name__ if model else None
    scaler_type = type(scaler).__name__ if scaler else None
    using_fallback = "RandomForestClassifier" in str(model_type)
    
    # Check if model has predict_proba
    has_predict_proba = hasattr(model, 'predict_proba') if model else False
    
    # Vérifier les fichiers
    pkl_files = [f for f in os.listdir(".") if f.endswith(".pkl")]
    
    return {
        "model_type": model_type,
        "scaler_type": scaler_type,
        "using_fallback": using_fallback,
        "feature_names": feature_names,
        "features_count": len(feature_names),
        "available_pkl_files": pkl_files,
        "model_loaded": model is not None,
        "scaler_loaded": scaler is not None,
        "has_predict_proba": has_predict_proba,
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("🚀 BotaniAI ML Service Ready!")
    print("=" * 60)
    print(f"🌐 Server: http://localhost:8000")
    print(f"🤖 Predict: POST http://localhost:8000/predict")
    print(f"📊 Model Info: GET http://localhost:8000/model-info")
    print(f"🧪 Test: GET http://localhost:8000/test")
    print(f"📚 Docs: http://localhost:8000/docs")
    print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=8000)