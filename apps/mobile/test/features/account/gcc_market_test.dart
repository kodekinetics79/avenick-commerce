import 'package:avenick/api/models/enums.dart';
import 'package:avenick/features/account/data/gcc_market.dart';
import 'package:avenick/features/account/data/map_pin.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PhoneNumber.parse', () {
    test('a local number with a trunk zero becomes E.164', () {
      // How everyone in the Gulf writes their own number.
      final PhoneNumber phone = PhoneNumber.parse(
        '050 123 4567',
        market: GccMarket.ae,
      );
      expect(phone.e164, '+971501234567');
      expect(phone.isValid, isTrue);
      expect(phone.looksLikeMobile, isTrue);
    });

    test('separators, brackets and spaces are all dropped', () {
      expect(
        PhoneNumber.parse('(050) 123-4567', market: GccMarket.ae).e164,
        '+971501234567',
      );
    });

    test('an explicit country code overrides the picker', () {
      // Somebody with a Saudi number standing in Dubai. The picker says AE and
      // the paste says +966; the paste wins, because they typed it.
      final PhoneNumber phone = PhoneNumber.parse(
        '+966 50 123 4567',
        market: GccMarket.ae,
      );
      expect(phone.market, GccMarket.sa);
      expect(phone.e164, '+966501234567');
    });

    test('the 00 international prefix is understood', () {
      expect(
        PhoneNumber.parse('00971501234567', market: GccMarket.qa).e164,
        '+971501234567',
      );
    });

    test('Arabic-Indic digits are folded to ASCII', () {
      // Typed on an Arabic keyboard. The number must be the same number.
      final PhoneNumber phone = PhoneNumber.parse(
        '٠٥٠١٢٣٤٥٦٧',
        market: GccMarket.ae,
      );
      expect(phone.e164, '+971501234567');
    });

    test('every market knows its own length', () {
      const Map<GccMarket, String> samples = <GccMarket, String>{
        GccMarket.ae: '501234567',
        GccMarket.sa: '501234567',
        GccMarket.qa: '33123456',
        GccMarket.kw: '51234567',
        GccMarket.om: '91234567',
        GccMarket.bh: '31234567',
      };
      for (final MapEntry<GccMarket, String> entry in samples.entries) {
        final PhoneNumber phone = PhoneNumber.parse(
          entry.value,
          market: entry.key,
        );
        expect(
          phone.isValid,
          isTrue,
          reason: '${entry.key.nameEn} should accept ${entry.value}',
        );
        expect(phone.e164, '+${entry.key.dialCode}${entry.value}');
      }
    });

    test('a short number is not valid and a long one is not either', () {
      expect(PhoneNumber.parse('5012345', market: GccMarket.ae).isValid, false);
      expect(
        PhoneNumber.parse('50123456789', market: GccMarket.ae).isValid,
        false,
      );
    });

    test('an unknown prefix is a WARNING, never a block', () {
      // Numbering plans grow. Refusing a real customer's real number because a
      // hardcoded prefix list has not been updated is worse than one wasted
      // SMS.
      final PhoneNumber phone = PhoneNumber.parse(
        '441234567',
        market: GccMarket.ae,
      );
      expect(phone.looksLikeMobile, isFalse);
      expect(phone.isValid, isTrue, reason: 'length is the only hard rule');
    });
  });

  group('PhoneNumber display', () {
    test('grouping follows the market', () {
      expect(
        PhoneNumber.parse('501234567', market: GccMarket.ae).nationalDisplay,
        '50 123 4567',
      );
      expect(
        PhoneNumber.parse('33123456', market: GccMarket.qa).nationalDisplay,
        '3312 3456',
      );
    });

    test('masked keeps only the last two digits', () {
      final PhoneNumber phone = PhoneNumber.parse(
        '501234567',
        market: GccMarket.ae,
      );
      expect(phone.masked.endsWith('67'), isTrue);
      expect(
        phone.masked.contains('50 123'),
        isFalse,
        reason: 'a full number on a screen someone else can see is a number '
            'someone else can now use',
      );
    });

    test('fromE164 round-trips a stored Me.phone', () {
      final PhoneNumber? phone = PhoneNumber.fromE164('+971501234567');
      expect(phone, isNotNull);
      expect(phone!.market, GccMarket.ae);
      expect(phone.nationalDigits, '501234567');
      expect(PhoneNumber.fromE164(null), isNull);
      expect(
        PhoneNumber.fromE164('+441234567890'),
        isNull,
        reason: 'a non-GCC number has no market here',
      );
    });
  });

  group('GccMarket', () {
    test('the six markets map onto the six contract countries', () {
      expect(
        GccMarket.values.map((GccMarket m) => m.country).toSet(),
        Country.values.toSet(),
      );
    });

    test('the three-decimal currencies are the three-decimal markets', () {
      // KWD, OMR and BHD are 3-digit currencies. Getting this wrong is the
      // wrong number by a factor of ten in the last place a buyer reads.
      final Set<GccMarket> threeDigit = <GccMarket>{
        for (final GccMarket m in GccMarket.values)
          if (m.currency.decimalDigits == 3) m,
      };
      expect(threeDigit, <GccMarket>{
        GccMarket.kw,
        GccMarket.om,
        GccMarket.bh,
      });
    });

    test('every dial code is distinct', () {
      final Set<String> codes =
          GccMarket.values.map((GccMarket m) => m.dialCode).toSet();
      expect(codes.length, GccMarket.values.length);
    });
  });

  group('MapPin.tryParse', () {
    test('a bare pair', () {
      final MapPin? pin = MapPin.tryParse('25.204849, 55.270783');
      expect(pin, isNotNull);
      expect(pin!.latitude, closeTo(25.204849, 1e-9));
      expect(pin.longitude, closeTo(55.270783, 1e-9));
      expect(pin.isPlausiblyGcc, isTrue);
    });

    test('a Google Maps place link prefers the PLACE over the map centre', () {
      // A share URL carries both. `@` is where the map was looking; `!3d!4d`
      // is the pin somebody actually dropped.
      final MapPin? pin = MapPin.tryParse(
        'https://www.google.com/maps/place/Burj+Khalifa/@25.1000,55.1000,17z/'
        'data=!3m1!4b1!4m5!3m4!1s0x0:0x0!8m2!3d25.197197!4d55.274376',
      );
      expect(pin, isNotNull);
      expect(pin!.latitude, closeTo(25.197197, 1e-9));
      expect(pin.longitude, closeTo(55.274376, 1e-9));
    });

    test('a maps query link', () {
      expect(
        MapPin.tryParse('https://maps.google.com/?q=24.7136,46.6753'),
        const MapPin(latitude: 24.7136, longitude: 46.6753),
      );
    });

    test('an Apple Maps link', () {
      expect(
        MapPin.tryParse('https://maps.apple.com/?ll=25.2769,55.2963&z=16'),
        const MapPin(latitude: 25.2769, longitude: 55.2963),
      );
    });

    test('an @-centred link when there is no place', () {
      expect(
        MapPin.tryParse('https://www.google.com/maps/@26.2285,50.5860,15z'),
        const MapPin(latitude: 26.2285, longitude: 50.5860),
      );
    });

    test('a geo: URI', () {
      expect(
        MapPin.tryParse('geo:29.3759,47.9774'),
        const MapPin(latitude: 29.3759, longitude: 47.9774),
      );
    });

    test('out-of-range numbers are refused, not clamped', () {
      // A swapped pair is the classic GeoJSON copy-paste. Storing it would put
      // the pin in the Indian Ocean and nothing downstream would notice.
      expect(MapPin.tryParse('155.2, 55.2'), isNull);
      expect(MapPin.tryParse('25.2, 255.2'), isNull);
    });

    test('nothing usable returns null rather than a guess', () {
      expect(MapPin.tryParse(''), isNull);
      expect(MapPin.tryParse('behind the ADNOC station'), isNull);
      expect(MapPin.tryParse('villa 12'), isNull);
    });

    test('a pin outside the Gulf parses but is flagged', () {
      final MapPin? pin = MapPin.tryParse('51.5074, -0.1278');
      expect(pin, isNotNull);
      expect(
        pin!.isPlausiblyGcc,
        isFalse,
        reason: 'a warning, not a rule — people do order across borders',
      );
    });
  });
}
