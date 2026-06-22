import os, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
django.setup()

from api.models import Location

COORDS = {
    'Aberdeen': (57.1499, -2.0940), 'Abu Dhabi City': (24.4539, 54.3773),
    'Agra': (27.1767, 78.0081), 'Ahmedabad': (23.0225, 72.5714),
    'Ajmer': (26.4499, 74.6399), 'Al Ain': (24.2075, 55.7447),
    'Al Dhafra': (23.3000, 53.0000), 'Ang Mo Kio': (1.3698, 103.8476),
    'Arrah': (25.5543, 84.6621), 'Asansol': (23.6739, 86.9524),
    'Augsburg': (48.3705, 10.8978), 'Aurangabad': (19.8762, 75.3433),
    'Aurora': (41.7606, -88.3201), 'Austin': (30.2672, -97.7431),
    'Ballarat': (-37.5622, 143.8503), 'Bangalore': (12.9716, 77.5946),
    'Begusarai': (25.4173, 86.1328), 'Belfast': (54.5973, -5.9301),
    'Belgaum': (15.8497, 74.4977), 'Bellevue': (47.6101, -122.2015),
    'Bendigo': (-36.7570, 144.2794), 'Berlin City': (52.5200, 13.4050),
    'Bhagalpur': (25.2425, 86.9842), 'Bhavnagar': (21.7645, 72.1519),
    'Birmingham': (52.4862, -1.8904), 'Bonn': (50.7374, 7.0982),
    'Brampton': (43.7315, -79.7624), 'Brisbane': (-27.4698, 153.0251),
    'Bristol': (51.4545, -2.5879), 'Buffalo': (42.8864, -78.8784),
    'Bunbury': (-33.3271, 115.6405), 'Burnaby': (49.2488, -122.9805),
    'Calgary': (51.0447, -114.0719), 'Cardiff': (51.4816, -3.1791),
    'Central Area': (1.2895, 103.8500), 'Central Coast': (-33.4143, 151.3427),
    'Chennai': (13.0827, 80.2707), 'Chicago': (41.8781, -87.6298),
    'Coimbatore': (11.0168, 76.9558), 'Cologne': (50.9333, 6.9500),
    'Dallas': (32.7767, -96.7970), 'Darbhanga': (26.1520, 85.8956),
    'Darmstadt': (49.8728, 8.6512), 'Derry': (54.9958, -7.3074),
    'Dortmund': (51.5136, 7.4653), 'Dubai City': (25.2048, 55.2708),
    'Dundee': (56.4620, -2.9707), 'Durgapur': (23.5204, 87.3119),
    'Düsseldorf': (51.2217, 6.7762), 'East Delhi': (28.6448, 77.3165),
    'Edinburgh': (55.9533, -3.1883), 'Edmonton': (53.5461, -113.4938),
    'Essen': (51.4556, 7.0116), 'Everett': (47.9790, -122.2021),
    'Fort Worth': (32.7555, -97.3308), 'Frankfurt': (50.1109, 8.6821),
    'Gatineau': (45.4765, -75.7013), 'Gaya': (24.7914, 85.0002),
    'Geelong': (-38.1499, 144.3617), 'Ghaziabad': (28.6692, 77.4538),
    'Glasgow': (55.8642, -4.2518), 'Gold Coast': (-28.0167, 153.4000),
    'Hamilton': (43.2557, -79.8711), 'Hatta': (24.8019, 56.1145),
    'Houston': (29.7604, -95.3698), 'Howrah': (22.5958, 88.2636),
    'Hubli': (15.3647, 75.1240), 'Hyderabad': (17.3850, 78.4867),
    'Inverness': (57.4778, -4.2247), 'Jacksonville': (30.3322, -81.6557),
    'Jaipur': (26.9124, 75.7873), 'Jebel Ali': (24.9969, 55.0592),
    'Jodhpur': (26.2389, 73.0243), 'Joliet': (41.5250, -88.0817),
    'Jurong East': (1.3329, 103.7436), 'Kalba': (25.0679, 56.3566),
    'Kanpur': (26.4499, 80.3319), 'Karimnagar': (18.4386, 79.1288),
    'Kassel': (51.3127, 9.4797), 'Katihar': (25.5464, 87.5682),
    'Khammam': (17.2473, 80.1514), 'Khor Fakkan': (25.3393, 56.3545),
    'Kochi': (9.9312, 76.2673), 'Kolkata': (22.5726, 88.3639),
    'Kota': (25.2138, 75.8648), 'Kozhikode': (11.2588, 75.7804),
    'Laval': (45.5708, -73.6924), 'Leeds': (53.8008, -1.5491),
    'Lethbridge': (49.6956, -112.8451), 'Lisburn': (54.5162, -6.0583),
    'Liverpool': (53.4084, -2.9916), 'London': (51.5074, -0.1278),
    'Los Angeles': (34.0522, -118.2437), 'Lucknow': (26.8467, 80.9462),
    'Madurai': (9.9252, 78.1198), 'Malappuram': (11.0510, 76.0711),
    'Manchester': (53.4808, -2.2426), 'Mandurah': (-32.5269, 115.7228),
    'Mangalore': (12.9141, 74.8560), 'Melbourne': (-37.8136, 144.9631),
    'Miami': (25.7617, -80.1918), 'Mississauga': (43.5890, -79.6441),
    'Montreal': (45.5017, -73.5673), 'Mumbai': (19.0760, 72.8777),
    'Munger': (25.3733, 86.4750), 'Munich': (48.1351, 11.5820),
    'Muzaffarpur': (26.1209, 85.3647), 'Mysore': (12.2958, 76.6394),
    'Nagpur': (21.1458, 79.0882), 'Naperville': (41.7508, -88.1535),
    'Nashik': (19.9975, 73.7898), 'New Delhi': (28.6139, 77.2090),
    'New York City': (40.7128, -74.0060), 'Newcastle': (54.9783, -1.6174),
    'Newport': (51.5842, -2.9977), 'Newry': (54.1751, -6.3392),
    'Nizamabad': (18.6726, 78.0940), 'Noida': (28.5355, 77.3910),
    'North Delhi': (28.7041, 77.1025), 'Nuremberg': (49.4521, 11.0767),
    'Orlando': (28.5383, -81.3792), 'Ottawa': (45.4215, -75.6972),
    'Patna': (25.5941, 85.1376), 'Perth': (-31.9505, 115.8605),
    'Pune': (18.5204, 73.8567), 'Purnia': (25.7771, 87.4753),
    'Quebec City': (46.8139, -71.2080), 'Rajkot': (22.3039, 70.8022),
    'Red Deer': (52.2681, -113.8112), 'Regensburg': (49.0134, 12.1016),
    'Richmond': (37.5407, -77.4360), 'Rochester': (43.1566, -77.6088),
    'Rockford': (42.2711, -89.0937), 'Sacramento': (38.5816, -121.4944),
    'Salem': (11.6643, 78.1460), 'San Antonio': (29.4241, -98.4936),
    'San Diego': (32.7157, -117.1611), 'San Francisco': (37.7749, -122.4194),
    'San Jose': (37.3382, -121.8863), 'Seattle': (47.6062, -122.3321),
    'Sharjah City': (25.3463, 55.4209), 'Siliguri': (26.7271, 88.3953),
    'South Delhi': (28.5272, 77.2271), 'Spokane': (47.6588, -117.4260),
    'Sunshine Coast': (-26.6500, 153.0667), 'Surat': (21.1702, 72.8311),
    'Surrey': (49.1913, -122.8490), 'Swansea': (51.6214, -3.9436),
    'Sydney': (-33.8688, 151.2093), 'Syracuse': (43.0481, -76.1474),
    'Tallahassee': (30.4383, -84.2807), 'Tampa': (27.9506, -82.4572),
    'Tampines': (1.3496, 103.9568), 'Thane': (19.2183, 72.9781),
    'Thiruvananthapuram': (8.5241, 76.9366), 'Tiruchirappalli': (10.7905, 78.7047),
    'Toronto': (43.6532, -79.3832), 'Townsville': (-19.2590, 146.8169),
    'Udaipur': (24.5854, 73.7125), 'Vadodara': (22.3072, 73.1812),
    'Vancouver': (49.2827, -123.1207), 'Varanasi': (25.3176, 82.9739),
    'Victoria': (48.4284, -123.3656), 'Warangal': (17.9689, 79.5941),
    'West Delhi': (28.6520, 77.0630), 'Wiesbaden': (50.0782, 8.2398),
    'Wollongong': (-34.4278, 150.8931), 'Woodlands': (1.4382, 103.7890),
    'Wrexham': (53.0461, -3.0015), 'Yonkers': (40.9312, -73.8988),
}

updated = 0
missing = []
for loc in Location.objects.filter(latitude__isnull=True):
    coords = COORDS.get(loc.city)
    if coords:
        loc.latitude, loc.longitude = coords
        loc.save(update_fields=['latitude', 'longitude'])
        updated += 1
    else:
        missing.append(loc.city)

print(f"Updated: {updated}")
if missing:
    print(f"Missing coords for: {missing}")
else:
    print("All locations have coordinates now.")
