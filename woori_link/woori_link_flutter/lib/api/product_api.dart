import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';

class ProductApi {
  static Future<List<dynamic>> getProductsBySenior(int seniorId) async {
    final res =
        await http.get(Uri.parse('$baseUrl/products/senior/$seniorId'));
    if (res.statusCode == 200) return jsonDecode(res.body);
    return [];
  }

  static Future<Map<String, dynamic>> registerProduct(
      Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$baseUrl/products'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    if (res.statusCode == 200 || res.statusCode == 201) {
      return jsonDecode(res.body);
    }
    throw Exception('제품 등록 실패');
  }

  static Future<void> deleteProduct(int productId) async {
    await http.delete(Uri.parse('$baseUrl/products/$productId'));
  }

  static Future<void> refreshProducts() async {
    await http.post(Uri.parse('$baseUrl/products/refresh'));
  }
}
