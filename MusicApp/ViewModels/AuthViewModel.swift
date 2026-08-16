import Foundation
import SwiftUI
import Combine

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var confirmPassword = ""
    @Published var displayName = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var isLoginMode = true
    @Published var showPassword = false
    @Published var showConfirmPassword = false
    @Published var isValidEmail = false
    @Published var passwordStrength: PasswordStrength = .weak
    
    enum PasswordStrength {
        case weak, fair, good, strong
        
        var label: String {
            switch self {
            case .weak: return "Weak"
            case .fair: return "Fair"
            case .good: return "Good"
            case .strong: return "Strong"
            }
        }
        
        var color: Color {
            switch self {
            case .weak: return .red
            case .fair: return .orange
            case .good: return .yellow
            case .strong: return .green
            }
        }
    }
    
    var canSubmit: Bool {
        if isLoginMode {
            return !email.isEmpty && !password.isEmpty && isValidEmail
        } else {
            return !email.isEmpty && !password.isEmpty && !displayName.isEmpty && password == confirmPassword && passwordStrength != .weak
        }
    }
    
    var emailRegex = #"^[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
    
    init() {
        setupValidation()
    }
    
    private func setupValidation() {
        $email.map { email in
            email.range(of: self.emailRegex, options: .regularExpression) != nil
        }
        .assign(to: &$isValidEmail)
        
        $password.map { password in
            var score = 0
            if password.count >= 8 { score += 1 }
            if password.count >= 12 { score += 1 }
            if password.rangeOfCharacter(from: .uppercaseLetters) != nil { score += 1 }
            if password.rangeOfCharacter(from: .lowercaseLetters) != nil { score += 1 }
            if password.rangeOfCharacter(from: .decimalDigits) != nil { score += 1 }
            if password.rangeOfCharacter(from: CharacterSet.alphanumerics.inverted) != nil { score += 1 }
            
            switch score {
            case 0...1: return .weak
            case 2...3: return .fair
            case 4...5: return .good
            default: return .strong
            }
        }
        .assign(to: &$passwordStrength)
    }
    
    func submit() async {
        guard canSubmit else { return }
        isLoading = true
        errorMessage = nil
        
        do {
            if isLoginMode {
                _ = try await DatabaseManager.shared.login(email: email, password: password)
            } else {
                _ = try await DatabaseManager.shared.createAccount(email: email, password: password, name: displayName)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func switchMode() {
        isLoginMode.toggle()
        errorMessage = nil
    }
}