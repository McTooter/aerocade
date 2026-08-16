import SwiftUI
import SwiftData

struct ProfilePickerView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var profiles: [UserProfile]
    @State private var showAddProfile = false
    @State private var showEditMode = false
    @State private var editingProfile: UserProfile?
    
    private let columns = [
        GridItem(.adaptive(minimum: 120), spacing: 20)
    ]
    
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "#0A0A0F"), Color(hex: "#14142B")],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            VStack(spacing: 30) {
                Text("Who's listening?")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                
                ScrollView {
                    LazyVGrid(columns: columns, spacing: 24) {
                        ForEach(profiles) { profile in
                            ProfileCard(
                                profile: profile,
                                isEditing: showEditMode
                            ) {
                                selectProfile(profile)
                            } onLongPress: {
                                editingProfile = profile
                            }
                        }
                        
                        if showEditMode || profiles.count < 5 {
                            AddProfileCard {
                                showAddProfile = true
                            }
                        }
                    }
                    .padding(.horizontal, 24)
                }
                
                VStack(spacing: 12) {
                    Button {
                        showEditMode.toggle()
                    } label: {
                        Text(showEditMode ? "Done" : "Manage Profiles")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.white.opacity(0.8))
                    }
                    
                    HStack(spacing: 6) {
                        Image(systemName: "signOut")
                        Text("Sign Out")
                    }
                    .font(.subheadline)
                    .foregroundColor(.red)
                    .onTapGesture {
                        DatabaseManager.shared.signOut()
                    }
                }
            }
        }
        .sheet(isPresented: $showAddProfile) {
            AddProfileView { name, color, isKids in
                do {
                    try DatabaseManager.shared.createProfile(name: name, avatarColor: color, isKids: isKids)
                } catch {
                    print("Failed to create profile: \(error)")
                }
            }
        }
        .sheet(item: $editingProfile) { profile in
            EditProfileView(profile: profile)
        }
    }
    
    @MainActor private func selectProfile(_ profile: UserProfile) {
        DatabaseManager.shared.setActiveProfile(profile)
    }
}

struct ProfileCard: View {
    let profile: UserProfile
    let isEditing: Bool
    let onTap: () -> Void
    let onLongPress: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 12) {
                ZStack(alignment: .topTrailing) {
                    AvatarView(profile: profile, size: 120)
                    
                    if isEditing {
                        Image(systemName: "pencil.circle.fill")
                            .font(.title2)
                            .foregroundColor(.white)
                            .background(Circle().fill(.black.opacity(0.5)))
                            .offset(x: 6, y: -6)
                    }
                }
                
                Text(profile.name)
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .buttonStyle(.plain)
        .onLongPressGesture {
            onLongPress()
        }
    }
}

struct AvatarView: View {
    let profile: UserProfile
    let size: CGFloat
    
    var body: some View {
        if let data = profile.avatarData, let image = UIImage(data: data) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: size * 0.2))
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: size * 0.2)
                    .fill(avatarColor(profile.avatarColor))
                
                Image(systemName: profile.isKidsProfile ? "face.smiling" : "person.fill")
                    .font(.system(size: size * 0.38))
                    .foregroundColor(.white.opacity(0.9))
            }
            .frame(width: size, height: size)
            .overlay(
                RoundedRectangle(cornerRadius: size * 0.2)
                    .stroke(.white.opacity(0.2), lineWidth: 1)
            )
        }
    }
    
    private func avatarColor(_ name: String) -> Color {
        switch name {
        case "red": return Color(hex: "#E50914")
        case "blue": return Color(hex: "#0071EB")
        case "green": return Color(hex: "#1DB954")
        case "purple": return Color(hex: "#9B59B6")
        case "orange": return Color(hex: "#FF8C00")
        case "pink": return Color(hex: "#FF69B4")
        case "teal": return Color(hex: "#14B8A6")
        case "yellow": return Color(hex: "#F5C518")
        case "gray": return Color(hex: "#6B7280")
        default: return Color(hex: "#0071EB")
        }
    }
}

struct AddProfileCard: View {
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 24)
                        .fill(.white.opacity(0.08))
                        .frame(width: 120, height: 120)
                    
                    Image(systemName: "plus")
                        .font(.system(size: 40))
                        .foregroundColor(.white.opacity(0.7))
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 24)
                        .stroke(.white.opacity(0.2), style: StrokeStyle(lineWidth: 2, dash: [8]))
                )
                
                Text("Add Profile")
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.white.opacity(0.7))
            }
        }
        .buttonStyle(.plain)
    }
}

struct AddProfileView: View {
    @Environment(\.dismiss) private var dismiss
    let onSave: (String, String, Bool) -> Void
    
    @State private var name = ""
    @State private var selectedColor = "blue"
    @State private var isKidsProfile = false
    
    private let colorOptions = ["red", "blue", "green", "purple", "orange", "pink", "teal", "yellow", "gray"]
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Profile Name") {
                    TextField("Name", text: $name)
                }
                
                Section("Avatar Color") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 44))], spacing: 12) {
                        ForEach(colorOptions, id: \.self) { color in
                            Circle()
                                .fill(AvatarColorPalette.color(color))
                                .frame(width: 40, height: 40)
                                .overlay(
                                    Circle()
                                        .stroke(selectedColor == color ? .white : .clear, lineWidth: 3)
                                )
                                .onTapGesture {
                                    selectedColor = color
                                }
                        }
                    }
                    .padding(.vertical, 4)
                }
                
                Section {
                    Toggle("Kid Profile", isOn: $isKidsProfile)
                }
                
                Section {
                    Button("Create Profile") {
                        onSave(name, selectedColor, isKidsProfile)
                        dismiss()
                    }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .navigationTitle("New Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

struct EditProfileView: View {
    @Environment(\.dismiss) private var dismiss
    let profile: UserProfile
    
    @State private var name: String
    @State private var selectedColor: String
    
    private let colorOptions = ["red", "blue", "green", "purple", "orange", "pink", "teal", "yellow", "gray"]
    
    init(profile: UserProfile) {
        self.profile = profile
        _name = State(initialValue: profile.name)
        _selectedColor = State(initialValue: profile.avatarColor)
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Profile Name") {
                    TextField("Name", text: $name)
                }
                
                Section("Avatar Color") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 44))], spacing: 12) {
                        ForEach(colorOptions, id: \.self) { color in
                            Circle()
                                .fill(AvatarColorPalette.color(color))
                                .frame(width: 40, height: 40)
                                .overlay(
                                    Circle()
                                        .stroke(selectedColor == color ? .white : .clear, lineWidth: 3)
                                )
                                .onTapGesture {
                                    selectedColor = color
                                }
                        }
                    }
                    .padding(.vertical, 4)
                }
                
                Section {
                    Button("Delete Profile", role: .destructive) {
                        try? DatabaseManager.shared.deleteProfile(profile)
                        dismiss()
                    }
                }
            }
            .navigationTitle("Edit Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        DatabaseManager.shared.renameProfile(profile, to: name)
                        DatabaseManager.shared.updateProfileAvatar(profile, color: selectedColor)
                        dismiss()
                    }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

enum AvatarColorPalette {
    static func color(_ name: String) -> Color {
        switch name {
        case "red": return Color(hex: "#E50914")
        case "blue": return Color(hex: "#0071EB")
        case "green": return Color(hex: "#1DB954")
        case "purple": return Color(hex: "#9B59B6")
        case "orange": return Color(hex: "#FF8C00")
        case "pink": return Color(hex: "#FF69B4")
        case "teal": return Color(hex: "#14B8A6")
        case "yellow": return Color(hex: "#F5C518")
        case "gray": return Color(hex: "#6B7280")
        default: return Color(hex: "#0071EB")
        }
    }
}